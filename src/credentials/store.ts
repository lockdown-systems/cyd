import fs from "fs";
import path from "path";

import { safeStorage } from "electron";
import log from "electron-log/main";

import { getSettingsPath } from "../util";
import { getCredentialProtection } from "./backend";

// Credentials live in their own directory beside the settings database, and
// never inside an account's database, media directory, or archive, so that
// backing up or exporting account data can never carry them along.
const CREDENTIALS_DIRECTORY = "credentials";

// The vault file format. Version 1 held only ciphertext, before Cyd persisted
// credentials on desktops the operating system cannot protect.
const VAULT_VERSION = 2;
const LEGACY_VAULT_VERSION = 1;

const OWNER_ONLY_DIRECTORY = 0o700;
const OWNER_ONLY_FILE = 0o600;

// Windows has no POSIX permission bits, and chmod there is a lie that can
// throw on some filesystems.
const supportsOwnerOnlyPermissions = (): boolean =>
  process.platform !== "win32";

type VaultEntry = {
  // Whether `value` is ciphertext from the operating system's facility. When
  // this is false, `value` is the credential itself: Cyd persists it in the
  // clear rather than dropping a connection the user asked for, and discloses
  // that in the app.
  protected: boolean;
  value: string;
};

type Vault = {
  version: number;
  // Keys are credential names.
  credentials: Record<string, VaultEntry>;
};

const emptyVault = (): Vault => ({
  version: VAULT_VERSION,
  credentials: {},
});

/**
 * Each account owns one vault, named after the account. Deleting the account
 * deletes the vault, so nothing an account stores can outlive it.
 */
const accountVaultName = (accountID: number): string => {
  if (!Number.isInteger(accountID) || accountID < 0) {
    throw new Error(`Invalid account ID for a credential vault: ${accountID}`);
  }
  return `account-${accountID}`;
};

export const credentialsDirectoryPath = (): string =>
  path.join(getSettingsPath(), CREDENTIALS_DIRECTORY);

const ensureCredentialsDirectory = (): string => {
  const directory = credentialsDirectoryPath();
  if (!fs.existsSync(directory)) {
    fs.mkdirSync(directory, { recursive: true, mode: OWNER_ONLY_DIRECTORY });
  }
  if (supportsOwnerOnlyPermissions()) {
    fs.chmodSync(directory, OWNER_ONLY_DIRECTORY);
  }
  return directory;
};

const vaultPath = (vaultName: string): string =>
  path.join(credentialsDirectoryPath(), `${vaultName}.json`);

const parseEntry = (entry: unknown): VaultEntry => {
  // Version 1 wrote a bare base64 string, which was always ciphertext.
  if (typeof entry === "string") {
    return { protected: true, value: entry };
  }
  if (
    entry !== null &&
    typeof entry === "object" &&
    typeof (entry as VaultEntry).value === "string"
  ) {
    return {
      protected: (entry as VaultEntry).protected === true,
      value: (entry as VaultEntry).value,
    };
  }
  throw new Error("Vault holds an unreadable credential");
};

const readVault = (vaultName: string): Vault => {
  const filePath = vaultPath(vaultName);
  if (!fs.existsSync(filePath)) {
    return emptyVault();
  }
  try {
    const parsed = JSON.parse(fs.readFileSync(filePath, "utf-8")) as {
      version?: number;
      credentials?: Record<string, unknown>;
    };
    if (
      parsed?.version !== VAULT_VERSION &&
      parsed?.version !== LEGACY_VAULT_VERSION
    ) {
      throw new Error(`Unsupported vault version: ${parsed?.version}`);
    }
    if (typeof parsed.credentials !== "object" || parsed.credentials === null) {
      throw new Error("Vault is missing its credentials");
    }
    const credentials: Record<string, VaultEntry> = {};
    for (const [key, entry] of Object.entries(parsed.credentials)) {
      credentials[key] = parseEntry(entry);
    }
    return { version: VAULT_VERSION, credentials };
  } catch (error) {
    // A vault Cyd cannot read is a vault Cyd cannot use. Log the failure
    // without its contents and start over, which costs the user a
    // reconnection rather than a broken app.
    log.error(
      "credentials: could not read a credential vault, discarding it",
      error instanceof Error ? error.message : error,
    );
    return emptyVault();
  }
};

const writeVault = (vaultName: string, vault: Vault): void => {
  const filePath = vaultPath(vaultName);

  if (Object.keys(vault.credentials).length === 0) {
    // An empty vault is the same as no vault, and leaving the file behind
    // would suggest credentials still exist.
    if (fs.existsSync(filePath)) {
      fs.rmSync(filePath, { force: true });
    }
    return;
  }

  ensureCredentialsDirectory();
  fs.writeFileSync(filePath, JSON.stringify(vault), { mode: OWNER_ONLY_FILE });
  if (supportsOwnerOnlyPermissions()) {
    fs.chmodSync(filePath, OWNER_ONLY_FILE);
  }
};

/**
 * Encode a credential for the vault, protected if the operating system offers
 * anything to protect it with.
 *
 * Where it does not, Cyd stores the credential in the clear rather than
 * refusing: a desktop without a keyring is common, the user asked to stay
 * connected, and the alternative is an app that cannot do its job there. The
 * limitation is disclosed instead of hidden, by the same protection check
 * that lands here.
 */
const encodeCredential = (value: string): VaultEntry => {
  if (getCredentialProtection().osProtected) {
    try {
      return {
        protected: true,
        value: safeStorage.encryptString(value).toString("base64"),
      };
    } catch (error) {
      // The backend reported that it could protect this and then did not.
      log.error(
        "credentials: the OS credential facility refused to encrypt, storing in the clear",
        error instanceof Error ? error.message : error,
      );
    }
  }
  return { protected: false, value };
};

/**
 * One account's credentials.
 *
 * Callers name a credential and nothing else: which vault it belongs to, how
 * it is protected, and where it sits on disk are this module's business.
 * Credential names are never logged, because they can carry an identifier
 * such as a Bluesky DID.
 */
export type AccountCredentials = {
  get(key: string): string | null;
  set(key: string, value: string): void;
  delete(key: string): void;
  deleteWithPrefix(prefix: string): void;
  keys(): string[];
  deleteAll(): void;
};

export const accountCredentials = (accountID: number): AccountCredentials => {
  const vaultName = accountVaultName(accountID);

  return {
    get(key: string): string | null {
      const vault = readVault(vaultName);
      const entry = vault.credentials[key];
      if (entry === undefined) {
        return null;
      }
      if (!entry.protected) {
        return entry.value;
      }

      try {
        return safeStorage.decryptString(Buffer.from(entry.value, "base64"));
      } catch (error) {
        // The OS key changed, or the vault came from another machine. The
        // credential is unusable, so drop it instead of retrying forever.
        log.warn(
          `credentials: could not decrypt a credential for account ${accountID}, discarding it`,
          error instanceof Error ? error.message : error,
        );
        delete vault.credentials[key];
        writeVault(vaultName, vault);
        return null;
      }
    },

    set(key: string, value: string): void {
      const vault = readVault(vaultName);
      vault.credentials[key] = encodeCredential(value);
      writeVault(vaultName, vault);
    },

    delete(key: string): void {
      const vault = readVault(vaultName);
      if (!(key in vault.credentials)) {
        return;
      }
      delete vault.credentials[key];
      writeVault(vaultName, vault);
    },

    deleteWithPrefix(prefix: string): void {
      const vault = readVault(vaultName);
      let deleted = false;
      for (const key of Object.keys(vault.credentials)) {
        if (key.startsWith(prefix)) {
          delete vault.credentials[key];
          deleted = true;
        }
      }
      if (deleted) {
        writeVault(vaultName, vault);
      }
    },

    keys(): string[] {
      return Object.keys(readVault(vaultName).credentials);
    },

    deleteAll(): void {
      const filePath = vaultPath(vaultName);
      if (fs.existsSync(filePath)) {
        fs.rmSync(filePath, { force: true });
      }
    },
  };
};

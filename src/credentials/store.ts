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

const VAULT_VERSION = 1;

const OWNER_ONLY_DIRECTORY = 0o700;
const OWNER_ONLY_FILE = 0o600;

// A namespace becomes a filename, so it may not contain anything that could
// point at another directory.
const NAMESPACE_PATTERN = /^[a-z0-9][a-z0-9_-]*$/i;

// Windows has no POSIX permission bits, and chmod there is a lie that can
// throw on some filesystems.
const supportsOwnerOnlyPermissions = (): boolean =>
  process.platform !== "win32";

/**
 * Thrown when Cyd cannot protect a credential and therefore refuses to
 * persist it. Callers must handle this rather than fall back to plaintext.
 */
export class CredentialStorageUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CredentialStorageUnavailableError";
  }
}

type Vault = {
  version: number;
  // Keys are credential names; values are base64 ciphertext produced by the
  // operating system's credential facility.
  credentials: Record<string, string>;
};

const emptyVault = (): Vault => ({
  version: VAULT_VERSION,
  credentials: {},
});

const assertNamespace = (namespace: string): string => {
  if (!NAMESPACE_PATTERN.test(namespace)) {
    throw new Error(`Invalid credential namespace: ${namespace}`);
  }
  return namespace;
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

const vaultPath = (namespace: string): string =>
  path.join(credentialsDirectoryPath(), `${assertNamespace(namespace)}.json`);

const readVault = (namespace: string): Vault => {
  const filePath = vaultPath(namespace);
  if (!fs.existsSync(filePath)) {
    return emptyVault();
  }
  try {
    const parsed = JSON.parse(fs.readFileSync(filePath, "utf-8")) as Vault;
    if (!parsed || typeof parsed.credentials !== "object") {
      throw new Error("Vault is missing its credentials");
    }
    return { version: parsed.version ?? VAULT_VERSION, ...parsed };
  } catch (error) {
    // A vault Cyd cannot read is a vault Cyd cannot use. Log the failure
    // without its contents and start over, which costs the user a
    // reconnection rather than a broken app.
    log.error(
      `credentials: could not read the vault for ${namespace}, discarding it`,
      error instanceof Error ? error.message : error,
    );
    return emptyVault();
  }
};

const writeVault = (namespace: string, vault: Vault): void => {
  const filePath = vaultPath(namespace);

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
 * Whether the operating system can protect credentials right now. When this
 * is false, Cyd must do without persisted credentials rather than store them
 * in the clear.
 */
export const isCredentialStorageAvailable = (): boolean =>
  getCredentialProtection().canPersist;

/**
 * The credential namespace owned by one account. Deleting the account deletes
 * the whole namespace, so nothing an account stores can outlive it.
 */
export const accountCredentialNamespace = (accountID: number): string =>
  `account-${accountID}`;

export const setCredential = (
  namespace: string,
  key: string,
  value: string,
): void => {
  assertNamespace(namespace);

  if (!isCredentialStorageAvailable()) {
    throw new CredentialStorageUnavailableError(
      "No operating-system credential storage is available, so Cyd refuses to persist this credential",
    );
  }

  const vault = readVault(namespace);
  vault.credentials[key] = safeStorage.encryptString(value).toString("base64");
  writeVault(namespace, vault);
};

export const getCredential = (
  namespace: string,
  key: string,
): string | null => {
  assertNamespace(namespace);

  const vault = readVault(namespace);
  const ciphertext = vault.credentials[key];
  if (ciphertext === undefined) {
    return null;
  }

  try {
    return safeStorage.decryptString(Buffer.from(ciphertext, "base64"));
  } catch (error) {
    // The OS key changed, or the vault came from another machine. The
    // credential is unusable, so drop it instead of retrying forever.
    log.warn(
      `credentials: could not decrypt ${namespace}/${key}, discarding it`,
      error instanceof Error ? error.message : error,
    );
    delete vault.credentials[key];
    writeVault(namespace, vault);
    return null;
  }
};

export const listCredentialKeys = (namespace: string): string[] =>
  Object.keys(readVault(assertNamespace(namespace)).credentials);

export const deleteCredential = (namespace: string, key: string): void => {
  assertNamespace(namespace);
  const vault = readVault(namespace);
  if (!(key in vault.credentials)) {
    return;
  }
  delete vault.credentials[key];
  writeVault(namespace, vault);
};

export const deleteCredentialsWithPrefix = (
  namespace: string,
  prefix: string,
): void => {
  assertNamespace(namespace);
  const vault = readVault(namespace);
  let deleted = false;
  for (const key of Object.keys(vault.credentials)) {
    if (key.startsWith(prefix)) {
      delete vault.credentials[key];
      deleted = true;
    }
  }
  if (deleted) {
    writeVault(namespace, vault);
  }
};

export const deleteCredentialNamespace = (namespace: string): void => {
  const filePath = vaultPath(namespace);
  if (fs.existsSync(filePath)) {
    fs.rmSync(filePath, { force: true });
  }
};

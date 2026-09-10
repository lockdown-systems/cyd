import { safeStorage } from "electron";
import log from "electron-log/main";

import type { CredentialBackend, CredentialProtection } from "../shared_types";

// Chromium has shipped several KWallet integrations, and each reports its own
// password-store name. They all protect credentials with the same wallet.
const KWALLET_BACKENDS = new Set(["kwallet", "kwallet5", "kwallet6"]);

// `gnome_keyring` is Chromium's older libsecret-backed store, kept here so a
// protected desktop is not reported as unprotected on older distributions.
const LIBSECRET_BACKENDS = new Set(["gnome_libsecret", "gnome_keyring"]);

const unavailableProtection = (platform: string): CredentialProtection => ({
  backend: "unavailable",
  rawBackend: null,
  platform,
  osProtected: false,
  canPersist: false,
  disclosureRequired: true,
});

/**
 * Chromium only selects a password store on Linux; asking anywhere else either
 * throws or returns a value that means nothing.
 */
const selectedLinuxBackend = (): string => {
  if (typeof safeStorage.getSelectedStorageBackend !== "function") {
    return "unknown";
  }
  return safeStorage.getSelectedStorageBackend() ?? "unknown";
};

const linuxBackend = (rawBackend: string): CredentialBackend => {
  if (LIBSECRET_BACKENDS.has(rawBackend)) {
    return "gnome_libsecret";
  }
  if (KWALLET_BACKENDS.has(rawBackend)) {
    return "kwallet";
  }
  if (rawBackend === "basic_text") {
    return "basic_text";
  }
  // Cyd cannot describe a store it does not recognize, and guessing here would
  // claim protection the user may not have.
  return "unknown";
};

/**
 * Report which facility protects Cyd's persisted credentials at rest.
 *
 * This is the single place that decides whether Cyd may persist credentials,
 * and whether it owes the user a disclosure about how weakly they are
 * protected. It never claims more protection than the selected backend
 * provides.
 */
export const getCredentialProtection = (): CredentialProtection => {
  const platform = process.platform;

  let encryptionAvailable: boolean;
  try {
    encryptionAvailable = safeStorage.isEncryptionAvailable();
  } catch (error) {
    // safeStorage throws when the app is not ready, and on Linux when no
    // password store could be selected at all.
    log.warn("getCredentialProtection: safeStorage is unavailable", error);
    return unavailableProtection(platform);
  }

  if (!encryptionAvailable) {
    return unavailableProtection(platform);
  }

  if (platform === "darwin") {
    return {
      backend: "macos_keychain",
      rawBackend: null,
      platform,
      osProtected: true,
      canPersist: true,
      disclosureRequired: false,
    };
  }

  if (platform === "win32") {
    return {
      backend: "windows_dpapi",
      rawBackend: null,
      platform,
      osProtected: true,
      canPersist: true,
      disclosureRequired: false,
    };
  }

  if (platform === "linux") {
    let rawBackend: string;
    try {
      rawBackend = selectedLinuxBackend();
    } catch (error) {
      log.warn(
        "getCredentialProtection: could not read the Linux password store",
        error,
      );
      rawBackend = "unknown";
    }
    const backend = linuxBackend(rawBackend);
    const osProtected = backend === "gnome_libsecret" || backend === "kwallet";
    return {
      backend,
      rawBackend,
      platform,
      // libsecret and KWallet are the only Linux stores Cyd treats as
      // protecting credentials.
      osProtected,
      // basic_text is the one deliberate fallback: it protects nothing, but
      // a Linux desktop without a keyring is common and refusing there would
      // leave those users unable to connect at all. A store Cyd does not
      // recognize gets no such benefit of the doubt, because Cyd cannot say
      // what it protects against.
      canPersist: osProtected || backend === "basic_text",
      disclosureRequired: !osProtected,
    };
  }

  // Cyd only ships on macOS, Windows, and Linux. Any other platform has no
  // vetted credential facility, so it gets none.
  return unavailableProtection(platform);
};

/**
 * Record the credential protection once at startup so support logs say which
 * backend was in use without ever recording a credential.
 */
export const logCredentialProtection = (): CredentialProtection => {
  const protection = getCredentialProtection();
  log.info(
    "Credential protection:",
    JSON.stringify({
      platform: protection.platform,
      backend: protection.backend,
      rawBackend: protection.rawBackend,
      osProtected: protection.osProtected,
      canPersist: protection.canPersist,
    }),
  );
  if (protection.disclosureRequired) {
    log.warn(
      `Credential protection: persisted credentials are NOT protected at rest (backend=${protection.backend})`,
    );
  }
  return protection;
};

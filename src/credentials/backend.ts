import { safeStorage } from "electron";
import log from "electron-log/main";

import type { CredentialBackend, CredentialProtection } from "../shared_types";

// Chromium has shipped several KWallet integrations, and each reports its own
// password-store name. They all protect credentials with the same wallet.
const KWALLET_BACKENDS = new Set(["kwallet", "kwallet5", "kwallet6"]);

// `gnome_keyring` is Chromium's older libsecret-backed store, kept here so a
// protected desktop is not reported as unprotected on older distributions.
const LIBSECRET_BACKENDS = new Set(["gnome_libsecret", "gnome_keyring"]);

/**
 * Chromium only selects a password store on Linux; asking anywhere else either
 * throws or returns a value that means nothing.
 *
 * This is read even when encryption is unavailable, because naming the store
 * the desktop chose is the difference between a warning the user can act on
 * and one they cannot.
 */
const selectedLinuxBackend = (): string | null => {
  if (typeof safeStorage.getSelectedStorageBackend !== "function") {
    return null;
  }
  try {
    return safeStorage.getSelectedStorageBackend() ?? null;
  } catch (error) {
    log.warn(
      "getCredentialProtection: could not read the Linux password store",
      error,
    );
    return null;
  }
};

const linuxBackend = (rawBackend: string | null): CredentialBackend => {
  if (rawBackend === null) {
    return "unavailable";
  }
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

const isProtectedLinuxBackend = (backend: CredentialBackend): boolean =>
  backend === "gnome_libsecret" || backend === "kwallet";

/**
 * Report which facility protects Cyd's persisted credentials at rest.
 *
 * This is the single place that decides whether the operating system protects
 * a credential, and therefore whether Cyd owes the user a disclosure that it
 * does not. It never claims more protection than the selected backend
 * provides. It never decides whether to persist: Cyd always does.
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
    encryptionAvailable = false;
  }

  if (platform === "linux") {
    const rawBackend = selectedLinuxBackend();
    const backend = linuxBackend(rawBackend);
    // Electron reports encryption as unavailable whenever Chromium fell back
    // to basic_text, so a keyring-backed name is not on its own a promise
    // that the keyring answered.
    const osProtected = encryptionAvailable && isProtectedLinuxBackend(backend);
    return {
      backend,
      rawBackend,
      platform,
      osProtected,
      disclosureRequired: !osProtected,
    };
  }

  if (platform === "darwin" || platform === "win32") {
    const backend: CredentialBackend =
      platform === "darwin" ? "macos_keychain" : "windows_dpapi";
    return {
      // Chromium only exposes a selected password store on Linux.
      backend: encryptionAvailable ? backend : "unavailable",
      rawBackend: null,
      platform,
      osProtected: encryptionAvailable,
      disclosureRequired: !encryptionAvailable,
    };
  }

  // Cyd only ships on macOS, Windows, and Linux. Any other platform has no
  // vetted credential facility, so it gets none.
  return {
    backend: "unavailable",
    rawBackend: null,
    platform,
    osProtected: false,
    disclosureRequired: true,
  };
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
    }),
  );
  if (protection.disclosureRequired) {
    log.warn(
      `Credential protection: persisted credentials are NOT protected at rest (backend=${protection.backend})`,
    );
  }
  return protection;
};

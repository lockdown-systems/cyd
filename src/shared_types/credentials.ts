/**
 * Which facility protects Cyd's persisted credentials at rest.
 *
 * These names describe what the operating system actually provides, not what
 * Cyd would like it to provide. `basic_text` is Chromium's obfuscation-only
 * fallback, `unknown` is a Linux password store Cyd cannot vouch for, and
 * `unavailable` means nothing can be persisted at all.
 */
export type CredentialBackend =
  | "macos_keychain"
  | "windows_dpapi"
  | "gnome_libsecret"
  | "kwallet"
  | "basic_text"
  | "unknown"
  | "unavailable";

export type CredentialProtection = {
  backend: CredentialBackend;
  // The raw Chromium password-store name on Linux, so diagnostics and support
  // conversations can name the exact backend rather than Cyd's summary of it.
  rawBackend: string | null;
  platform: string;
  // The operating system, rather than Cyd, protects credentials at rest.
  osProtected: boolean;
  // Cyd can persist credentials at all.
  canPersist: boolean;
  // The user must be told that persisted credentials are not protected at rest.
  disclosureRequired: boolean;
};

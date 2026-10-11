// These names describe what the OS actually provides: `basic_text`,
// `unknown`, and `unavailable` mean credentials are persisted in the clear.
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
  // The operating system, rather than Cyd, protects credentials at rest. When
  // this is false the credentials are on disk in the clear.
  osProtected: boolean;
  // The user must be told that persisted credentials are not protected at rest.
  disclosureRequired: boolean;
};

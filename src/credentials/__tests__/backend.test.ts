import { describe, test, expect, beforeEach, afterEach, vi } from "vitest";

import { safeStorageMock } from "../../__tests__/platform-fixtures/electronMocks";

import { getCredentialProtection } from "../backend";

const originalPlatform = process.platform;

const setPlatform = (platform: string) => {
  Object.defineProperty(process, "platform", {
    value: platform,
    configurable: true,
  });
};

describe("getCredentialProtection", () => {
  beforeEach(() => {
    safeStorageMock.isEncryptionAvailable.mockReturnValue(true);
    safeStorageMock.getSelectedStorageBackend.mockReturnValue(
      "gnome_libsecret",
    );
  });

  afterEach(() => {
    setPlatform(originalPlatform);
    vi.clearAllMocks();
  });

  test("macOS credentials are protected by the Keychain", () => {
    setPlatform("darwin");

    const protection = getCredentialProtection();

    expect(protection.backend).toBe("macos_keychain");
    expect(protection.osProtected).toBe(true);
    expect(protection.disclosureRequired).toBe(false);
    // Chromium only exposes a selected password store on Linux.
    expect(protection.rawBackend).toBeNull();
  });

  test("Windows credentials are protected by the OS", () => {
    setPlatform("win32");

    const protection = getCredentialProtection();

    expect(protection.backend).toBe("windows_dpapi");
    expect(protection.osProtected).toBe(true);
    expect(protection.disclosureRequired).toBe(false);
  });

  test("Linux reports libsecret as protected", () => {
    setPlatform("linux");
    safeStorageMock.getSelectedStorageBackend.mockReturnValue(
      "gnome_libsecret",
    );

    const protection = getCredentialProtection();

    expect(protection.backend).toBe("gnome_libsecret");
    expect(protection.osProtected).toBe(true);
    expect(protection.disclosureRequired).toBe(false);
    expect(protection.rawBackend).toBe("gnome_libsecret");
  });

  test.each(["kwallet", "kwallet5", "kwallet6"])(
    "Linux reports %s as protected KWallet storage",
    (rawBackend) => {
      setPlatform("linux");
      safeStorageMock.getSelectedStorageBackend.mockReturnValue(rawBackend);

      const protection = getCredentialProtection();

      expect(protection.backend).toBe("kwallet");
      expect(protection.osProtected).toBe(true);
      expect(protection.disclosureRequired).toBe(false);
      expect(protection.rawBackend).toBe(rawBackend);
    },
  );

  test("Linux basic_text is unprotected and disclosed", () => {
    setPlatform("linux");
    // Real Electron reports encryption as unavailable whenever Chromium fell
    // back to basic_text, so the two go together.
    safeStorageMock.getSelectedStorageBackend.mockReturnValue("basic_text");
    safeStorageMock.isEncryptionAvailable.mockReturnValue(false);

    const protection = getCredentialProtection();

    // The store is still named, so the warning bar can say which one it is.
    expect(protection.backend).toBe("basic_text");
    expect(protection.rawBackend).toBe("basic_text");
    expect(protection.osProtected).toBe(false);
    expect(protection.disclosureRequired).toBe(true);
  });

  test("an unrecognized Linux backend is named but not vouched for", () => {
    setPlatform("linux");
    safeStorageMock.getSelectedStorageBackend.mockReturnValue("something_new");

    const protection = getCredentialProtection();

    // A store Cyd cannot describe gets no benefit of the doubt, even when
    // Chromium says it can encrypt.
    expect(protection.backend).toBe("unknown");
    expect(protection.rawBackend).toBe("something_new");
    expect(protection.osProtected).toBe(false);
    expect(protection.disclosureRequired).toBe(true);
  });

  test("a keyring-backed name without working encryption is not protected", () => {
    setPlatform("linux");
    safeStorageMock.getSelectedStorageBackend.mockReturnValue(
      "gnome_libsecret",
    );
    safeStorageMock.isEncryptionAvailable.mockReturnValue(false);

    const protection = getCredentialProtection();

    // The desktop named a keyring, but nothing answered, so Cyd must not
    // claim the credential is protected.
    expect(protection.backend).toBe("gnome_libsecret");
    expect(protection.osProtected).toBe(false);
    expect(protection.disclosureRequired).toBe(true);
  });

  test("Linux with no selectable password store is unavailable", () => {
    setPlatform("linux");
    safeStorageMock.getSelectedStorageBackend.mockReturnValue(null);
    safeStorageMock.isEncryptionAvailable.mockReturnValue(false);

    const protection = getCredentialProtection();

    expect(protection.backend).toBe("unavailable");
    expect(protection.rawBackend).toBeNull();
    expect(protection.osProtected).toBe(false);
    expect(protection.disclosureRequired).toBe(true);
  });

  test("macOS without working encryption is unavailable", () => {
    setPlatform("darwin");
    safeStorageMock.isEncryptionAvailable.mockReturnValue(false);

    const protection = getCredentialProtection();

    expect(protection.backend).toBe("unavailable");
    expect(protection.osProtected).toBe(false);
    expect(protection.disclosureRequired).toBe(true);
  });

  test("a throwing safeStorage is treated as unprotected", () => {
    setPlatform("darwin");
    safeStorageMock.isEncryptionAvailable.mockImplementation(() => {
      throw new Error("app not ready");
    });

    const protection = getCredentialProtection();

    expect(protection.backend).toBe("unavailable");
    expect(protection.osProtected).toBe(false);
    expect(protection.disclosureRequired).toBe(true);
  });
});

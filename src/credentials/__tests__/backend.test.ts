import { describe, test, expect, beforeEach, afterEach, vi } from "vitest";

const safeStorageMock = vi.hoisted(() => ({
  isEncryptionAvailable: vi.fn(() => true),
  getSelectedStorageBackend: vi.fn(() => "gnome_libsecret"),
  encryptString: vi.fn((plaintext: string) => Buffer.from(`enc:${plaintext}`)),
  decryptString: vi.fn((ciphertext: Buffer) =>
    ciphertext.toString().replace(/^enc:/, ""),
  ),
}));

vi.mock("electron", () => ({
  safeStorage: safeStorageMock,
  app: { getPath: vi.fn(() => "/tmp"), getVersion: vi.fn(() => "0.0.1") },
  ipcMain: { handle: vi.fn() },
}));

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
    expect(protection.canPersist).toBe(true);
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

  test("Linux basic_text is a persisted but disclosed fallback", () => {
    setPlatform("linux");
    safeStorageMock.getSelectedStorageBackend.mockReturnValue("basic_text");

    const protection = getCredentialProtection();

    expect(protection.backend).toBe("basic_text");
    expect(protection.osProtected).toBe(false);
    expect(protection.canPersist).toBe(true);
    expect(protection.disclosureRequired).toBe(true);
  });

  test("an unrecognized Linux backend claims no protection", () => {
    setPlatform("linux");
    safeStorageMock.getSelectedStorageBackend.mockReturnValue("something_new");

    const protection = getCredentialProtection();

    expect(protection.backend).toBe("unknown");
    expect(protection.osProtected).toBe(false);
    expect(protection.disclosureRequired).toBe(true);
    expect(protection.rawBackend).toBe("something_new");
  });

  test("credentials cannot be persisted when encryption is unavailable", () => {
    setPlatform("linux");
    safeStorageMock.isEncryptionAvailable.mockReturnValue(false);

    const protection = getCredentialProtection();

    expect(protection.backend).toBe("unavailable");
    expect(protection.canPersist).toBe(false);
    expect(protection.osProtected).toBe(false);
    expect(protection.disclosureRequired).toBe(true);
  });

  test("a throwing safeStorage is treated as unavailable", () => {
    setPlatform("darwin");
    safeStorageMock.isEncryptionAvailable.mockImplementation(() => {
      throw new Error("app not ready");
    });

    const protection = getCredentialProtection();

    expect(protection.backend).toBe("unavailable");
    expect(protection.canPersist).toBe(false);
  });
});

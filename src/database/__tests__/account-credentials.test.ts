import "../../__tests__/platform-fixtures/electronMocks";

import { describe, test, expect, afterEach, vi } from "vitest";

import { ipcMain, session } from "electron";

import { createTestAccount } from "../../__tests__/platform-fixtures/accountFactory";
import { accountCredentials } from "../../credentials";
import { deleteAccount, defineIPCDatabaseAccount } from "../account";

const revokeMock = vi.hoisted(() => vi.fn(async () => undefined));

vi.mock("../../account_x/ipc", () => ({
  revokeXBlueskyConnection: revokeMock,
  defineIPCX: vi.fn(),
}));

type IPCHandler = (event: unknown, ...args: unknown[]) => Promise<unknown>;

const deleteAccountOverIPC = async (accountID: number): Promise<void> => {
  defineIPCDatabaseAccount();
  const handle = ipcMain.handle as unknown as {
    mock: { calls: [string, IPCHandler][] };
  };
  const registered = handle.mock.calls.find(
    ([channel]) => channel === "database:deleteAccount",
  );
  if (!registered) {
    throw new Error("database:deleteAccount was never registered");
  }
  await registered[1](null, accountID);
};

describe("deleteAccount", () => {
  let cleanupAccount: (() => void) | null = null;

  afterEach(() => {
    cleanupAccount?.();
    cleanupAccount = null;
    revokeMock.mockClear();
  });

  test("removes every credential the account persisted", () => {
    const { account, cleanup } = createTestAccount({
      type: "X",
      username: "credential-deletion-test",
    });
    cleanupAccount = cleanup;
    const credentials = accountCredentials(account.id);
    credentials.set("blueskySessionStore-did:web:cyd", "the-session");
    expect(credentials.keys()).toHaveLength(1);

    deleteAccount(account.id);

    expect(credentials.keys()).toEqual([]);
  });

  test("revokes the account's connections before discarding them", async () => {
    const { account, cleanup } = createTestAccount({
      type: "X",
      username: "credential-revocation-test",
    });
    cleanupAccount = cleanup;
    const credentials = accountCredentials(account.id);
    credentials.set("blueskySessionStore-did:web:cyd", "the-session");

    await deleteAccountOverIPC(account.id);

    // Revocation runs first: once the local credentials are gone, Cyd can no
    // longer ask the authorization server to invalidate them.
    expect(revokeMock).toHaveBeenCalledWith(account.id);
    expect(credentials.keys()).toEqual([]);
    // Chromium holds X login cookies, so its partition is cleared too.
    const ses = session.fromPartition(`persist:account-${account.id}`) as {
      clearStorageData: ReturnType<typeof vi.fn>;
    };
    expect(ses.clearStorageData).toHaveBeenCalled();
  });

  test("still deletes the account when revocation fails", async () => {
    const { account, cleanup } = createTestAccount({
      type: "X",
      username: "credential-revocation-failure-test",
    });
    cleanupAccount = cleanup;
    const credentials = accountCredentials(account.id);
    credentials.set("blueskySessionStore-did:web:cyd", "the-session");
    revokeMock.mockRejectedValueOnce(new Error("offline"));

    await deleteAccountOverIPC(account.id);

    expect(credentials.keys()).toEqual([]);
  });
});

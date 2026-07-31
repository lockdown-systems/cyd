import fs from "fs";
import os from "os";
import path from "path";

import { afterEach, beforeEach, expect, test, vi } from "vitest";

const electronMocks = vi.hoisted(() => ({
  handlers: new Map<string, (...args: unknown[]) => unknown>(),
  fromPartition: vi.fn(),
  closeAllConnections: vi.fn(),
  clearStorageData: vi.fn(),
}));

vi.mock("electron", () => ({
  app: {
    getPath: vi.fn(() => ""),
    getVersion: vi.fn(() => "0.0.1"),
  },
  ipcMain: {
    handle: vi.fn(
      (channel: string, handler: (...args: unknown[]) => unknown) => {
        electronMocks.handlers.set(channel, handler);
      },
    ),
  },
  session: {
    fromPartition: electronMocks.fromPartition.mockReturnValue({
      closeAllConnections: electronMocks.closeAllConnections,
      clearStorageData: electronMocks.clearStorageData,
    }),
  },
}));

import * as database from "../../../database";
import { BlueskyLocalAccountController } from "../../bluesky_account_controller";

let temporaryRoot: string;

beforeEach(() => {
  temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), "cyd-bluesky-ipc-"));
  process.env.TEST_MODE = "1";
  process.env.TEST_SETTINGS_PATH = path.join(temporaryRoot, "settings");
  process.env.TEST_DATA_PATH = path.join(temporaryRoot, "data");
  database.getMainDatabase();
  database.runMainMigrations();
  electronMocks.handlers.clear();
  vi.clearAllMocks();
});

afterEach(() => {
  database.closeMainDatabase();
  fs.rmSync(temporaryRoot, { recursive: true, force: true });
});

test("confirmed deletion clears the account webview partition and local root", async () => {
  const account = database.selectAccountType(
    database.createAccount().id,
    "Bluesky",
  );
  const controller = new BlueskyLocalAccountController(account.id);
  controller.open();
  controller.storeMedia(Buffer.from("private media"));
  const localRoot = controller.paths.root;
  controller.close();

  database.defineIPCDatabaseAccount();
  const deleteHandler = electronMocks.handlers.get("database:deleteAccount");
  expect(deleteHandler).toBeDefined();

  await deleteHandler!({}, account.id, account.uuid);

  expect(electronMocks.fromPartition).toHaveBeenCalledWith(
    `persist:account-${account.id}`,
  );
  expect(electronMocks.closeAllConnections).toHaveBeenCalledOnce();
  expect(electronMocks.clearStorageData).toHaveBeenCalledOnce();
  expect(fs.existsSync(localRoot)).toBe(false);
  expect(database.getAccount(account.id)).toBeNull();
});

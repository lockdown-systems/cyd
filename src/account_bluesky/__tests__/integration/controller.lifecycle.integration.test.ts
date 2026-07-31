import fs from "fs";
import os from "os";
import path from "path";

import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("electron", () => ({
  app: {
    getPath: vi.fn(() => ""),
    getVersion: vi.fn(() => "0.0.1"),
  },
  ipcMain: { handle: vi.fn() },
  session: {
    fromPartition: vi.fn(() => ({
      closeAllConnections: vi.fn(),
      clearStorageData: vi.fn(),
    })),
  },
}));

import { BlueskyLocalAccountController } from "../../bluesky_account_controller";
import * as database from "../../../database";

describe("BlueskyLocalAccountController lifecycle", () => {
  let temporaryRoot: string;

  beforeEach(() => {
    temporaryRoot = fs.mkdtempSync(
      path.join(os.tmpdir(), "cyd-bluesky-local-account-"),
    );
    process.env.TEST_MODE = "1";
    process.env.TEST_SETTINGS_PATH = path.join(temporaryRoot, "settings");
    process.env.TEST_DATA_PATH = path.join(temporaryRoot, "data");
    database.getMainDatabase();
    database.runMainMigrations();
  });

  afterEach(() => {
    database.closeMainDatabase();
    fs.rmSync(temporaryRoot, { recursive: true, force: true });
  });

  test("creates and reopens a UUID-keyed account after its handle changes", () => {
    let account = database.createAccount();
    account = database.selectAccountType(account.id, "Bluesky");

    const controller = new BlueskyLocalAccountController(account.id);
    controller.open();
    const originalPaths = controller.paths;
    controller.bindDid("did:plc:alice");
    expect(() => controller.bindDid("did:plc:someone-else")).toThrow(
      "cannot be changed",
    );
    controller.updateProfile({
      handle: "alice.test",
      displayName: "Alice",
      avatarUrl: "https://cdn.example/alice.jpg",
    });
    controller.updateProfile({ handle: "renamed.test" });
    controller.close();

    const reopened = new BlueskyLocalAccountController(account.id);
    reopened.open();

    expect(reopened.account.uuid).toBe(account.uuid);
    expect(reopened.account.did).toBe("did:plc:alice");
    expect(reopened.account.handle).toBe("renamed.test");
    expect(reopened.paths).toEqual(originalPaths);
    expect(reopened.paths.root).toBe(
      path.join(process.env.TEST_DATA_PATH!, "Bluesky", account.uuid),
    );
    expect(fs.existsSync(reopened.paths.database)).toBe(true);
    expect(fs.existsSync(reopened.paths.media)).toBe(true);
    expect(fs.existsSync(reopened.paths.staging)).toBe(true);

    if (process.platform !== "win32") {
      expect(fs.statSync(reopened.paths.root).mode & 0o777).toBe(0o700);
      expect(fs.statSync(reopened.paths.database).mode & 0o777).toBe(0o600);
    }

    reopened.close();
  });

  test("isolates content-addressed media, job state, and staging by UUID", () => {
    const first = database.selectAccountType(
      database.createAccount().id,
      "Bluesky",
    );
    const second = database.selectAccountType(
      database.createAccount().id,
      "Bluesky",
    );
    const firstController = new BlueskyLocalAccountController(first.id);
    const secondController = new BlueskyLocalAccountController(second.id);
    firstController.open();
    secondController.open();

    const firstMedia = firstController.storeMedia(Buffer.from("same media"));
    const duplicateMedia = firstController.storeMedia(
      Buffer.from("same media"),
    );
    const secondMedia = secondController.storeMedia(Buffer.from("same media"));
    firstController.saveJobState({
      id: "save-posts",
      jobType: "save",
      status: "running",
      progress: { cursor: "one" },
    });
    firstController.close();
    firstController.open();

    expect(duplicateMedia).toEqual(firstMedia);
    expect(secondMedia.digest).toBe(firstMedia.digest);
    expect(secondMedia.path).not.toBe(firstMedia.path);
    expect(firstController.paths.staging).not.toBe(
      secondController.paths.staging,
    );
    expect(firstController.getJobState("save-posts")).toEqual({
      id: "save-posts",
      jobType: "save",
      status: "running",
      progress: { cursor: "one" },
    });
    expect(secondController.getJobState("save-posts")).toBeNull();

    if (process.platform !== "win32") {
      expect(fs.statSync(firstController.paths.media).mode & 0o777).toBe(0o700);
      expect(fs.statSync(firstController.paths.staging).mode & 0o777).toBe(
        0o700,
      );
      expect(fs.statSync(firstMedia.path).mode & 0o777).toBe(0o600);
    }

    firstController.close();
    secondController.close();
  });

  test("rejects a duplicate DID without changing the second profile", () => {
    const first = database.selectAccountType(
      database.createAccount().id,
      "Bluesky",
    );
    const second = database.selectAccountType(
      database.createAccount().id,
      "Bluesky",
    );
    const firstController = new BlueskyLocalAccountController(first.id);
    const secondController = new BlueskyLocalAccountController(second.id);
    firstController.open();
    secondController.open();
    firstController.bindDid("did:plc:shared");

    expect(() => secondController.bindDid("did:plc:shared")).toThrow();
    expect(secondController.account.did).toBeNull();
    expect(database.getAccount(second.id)?.blueskyLocalAccount?.did).toBeNull();

    firstController.close();
    secondController.close();
  });

  test("requires UUID confirmation and deletes only the selected account", async () => {
    const first = database.selectAccountType(
      database.createAccount().id,
      "Bluesky",
    );
    const second = database.selectAccountType(
      database.createAccount().id,
      "Bluesky",
    );
    const removedConnections: string[] = [];
    const connectionStore = {
      delete: async (uuid: string) => {
        removedConnections.push(uuid);
      },
    };
    const firstController = new BlueskyLocalAccountController(
      first.id,
      connectionStore,
    );
    const secondController = new BlueskyLocalAccountController(second.id, {
      delete: async () => undefined,
    });
    firstController.open();
    secondController.open();
    firstController.storeMedia(Buffer.from("first"));
    secondController.storeMedia(Buffer.from("second"));
    fs.writeFileSync(
      path.join(firstController.paths.staging, "import.part"),
      "staged",
    );

    await expect(firstController.deleteConfirmed(second.uuid)).rejects.toThrow(
      "confirmation",
    );
    expect(removedConnections).toEqual([]);
    expect(database.getAccount(first.id)).not.toBeNull();

    await firstController.deleteConfirmed(first.uuid);

    expect(removedConnections).toEqual([first.uuid]);
    expect(database.getAccount(first.id)).toBeNull();
    expect(fs.existsSync(firstController.paths.root)).toBe(false);
    expect(database.getAccount(second.id)).not.toBeNull();
    expect(fs.existsSync(secondController.paths.root)).toBe(true);

    secondController.close();
  });
});

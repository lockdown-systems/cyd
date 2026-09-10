import fs from "fs";
import path from "path";

import Database from "better-sqlite3";
import { beforeEach, afterEach, test, expect, vi } from "vitest";

// Mock the helpers module
vi.mock("./util", () => ({
  ...vi.importActual("./util"), // Import and spread the actual implementations
  getSettingsPath: vi.fn(() => {
    // Use the per-worker isolated path set up in test-setup.ts. Falling back
    // to the shared parent directory here caused parallel workers to delete
    // each other's databases during afterEach cleanup.
    const settingsPath =
      process.env.TEST_MODE === "1" && process.env.TEST_SETTINGS_PATH
        ? process.env.TEST_SETTINGS_PATH
        : path.join(__dirname, "..", "testdata", "settingsPath-database");
    if (!fs.existsSync(settingsPath)) {
      fs.mkdirSync(settingsPath, { recursive: true });
    }
    return settingsPath;
  }),
}));
import { getSettingsPath } from "./util";

// Mock electron's app.getVersion()
vi.mock("electron", () => ({
  app: {
    getVersion: vi.fn(() => "0.0.1"),
  },
}));

// Import the local modules after stuff has been mocked
// import { Account, XAccount } from './shared_types'
import * as database from "./database";

beforeEach(() => {
  // Make sure we open the database
  database.getMainDatabase();
  database.runMainMigrations();
});

afterEach(() => {
  // Make sure we close the database and clean up
  database.closeMainDatabase();
  const settingsPath = getSettingsPath();
  fs.readdirSync(settingsPath).forEach((file) => {
    fs.rmSync(path.join(settingsPath, file), { recursive: true, force: true });
  });
});

// database tests

test("config, account, xAccount, blueskyAccount, facebookAccount tables should be created", async () => {
  const db = database.getMainDatabase();
  const tables = await database.exec(
    db,
    "SELECT name FROM sqlite_master WHERE type='table';",
    [],
    "all",
  );
  expect(tables).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ name: "config" }),
      expect.objectContaining({ name: "account" }),
      expect.objectContaining({ name: "xAccount" }),
      expect.objectContaining({ name: "blueskyAccount" }),
      expect.objectContaining({ name: "facebookAccount" }),
    ]),
  );
});

test("the forward migration removes the dormant Bluesky model and its abandoned rows", () => {
  // Build a database that stopped just before the Bluesky replacement, the way
  // an installation that has been upgrading for months would look.
  const legacyPath = path.join(getSettingsPath(), "legacy-bluesky.sqlite");
  const legacyDB = new Database(legacyPath, {});
  const replacementIndex = database.mainMigrations.findIndex((migration) =>
    migration.name.startsWith("replace the dormant Bluesky model"),
  );
  expect(replacementIndex).toBeGreaterThan(0);
  database.runMigrations(
    legacyDB,
    database.mainMigrations.slice(0, replacementIndex),
  );

  // An abandoned Bluesky account, plus an X account that must survive.
  legacyDB
    .prepare("INSERT INTO blueskyAccount (username) VALUES (?)")
    .run("alice.bsky.social");
  legacyDB
    .prepare(
      "INSERT INTO account (type, sortOrder, uuid, blueskyAccountID) VALUES (?, ?, ?, ?)",
    )
    .run("Bluesky", 0, "018d5f7a-9b3c-7d10-8a2e-1f4c6b8d0e12", 1);
  legacyDB.prepare("INSERT INTO xAccount (username) VALUES (?)").run("alice");
  legacyDB
    .prepare(
      "INSERT INTO account (type, sortOrder, uuid, xAccountId) VALUES (?, ?, ?, ?)",
    )
    .run("X", 1, "018d5f7a-9b3c-7d10-8a2e-1f4c6b8d0e13", 1);

  database.runMigrations(legacyDB, database.mainMigrations);

  // The abandoned rows are gone rather than adapted, and no Bluesky settings
  // from the dormant model survive.
  const accountTypes = legacyDB.prepare("SELECT type FROM account").all() as {
    type: string;
  }[];
  expect(accountTypes.map((row) => row.type)).toEqual(["X"]);
  expect(
    (
      legacyDB
        .prepare("SELECT COUNT(*) AS count FROM blueskyAccount")
        .get() as {
        count: number;
      }
    ).count,
  ).toEqual(0);
  const columnNames = (
    legacyDB.prepare("PRAGMA table_info(blueskyAccount)").all() as {
      name: string;
    }[]
  ).map((column) => column.name);
  expect(columnNames).toContain("did");
  expect(columnNames).not.toContain("username");

  // Migration history itself is preserved.
  const migrationNames = (
    legacyDB.prepare("SELECT name FROM migrations ORDER BY id").all() as {
      name: string;
    }[]
  ).map((row) => row.name);
  expect(migrationNames).toEqual(
    database.mainMigrations.map((migration) => migration.name),
  );

  legacyDB.close();
});

test("setConfig should insert a new config value", () => {
  const key = "testKey";
  const value = "testValue";

  database.setConfig(key, value);

  const db = database.getMainDatabase();
  const result = database.exec(
    db,
    "SELECT value FROM config WHERE key = ?",
    [key],
    "get",
  );
  expect(result).toEqual({ value });
});

test("getConfig should retrieve the correct config value", () => {
  const key = "testKey";
  const value = "testValue";

  database.setConfig(key, value);
  const retrievedValue = database.getConfig(key);

  expect(retrievedValue).toBe(value);
});

test("getConfig should return null for a non-existent key", () => {
  const key = "nonExistentKey";
  const retrievedValue = database.getConfig(key);

  expect(retrievedValue).toBeNull();
});

test("createXAccount should create a new XAccount", () => {
  const xAccount = database.createXAccount();
  expect(xAccount).toHaveProperty("id");
  expect(xAccount).toHaveProperty("createdAt");
  expect(xAccount).toHaveProperty("updatedAt");
  expect(xAccount).toHaveProperty("accessedAt");
  expect(xAccount).toHaveProperty("username");
  expect(xAccount).toHaveProperty("profileImageDataURI");
  expect(xAccount).toHaveProperty("archiveTweets");
  expect(xAccount).toHaveProperty("archiveDMs");
  expect(xAccount).toHaveProperty("deleteTweets");
  expect(xAccount).toHaveProperty("deleteTweetsDaysOld");
  expect(xAccount).toHaveProperty("deleteTweetsLikesThresholdEnabled");
  expect(xAccount).toHaveProperty("deleteTweetsLikesThreshold");
  expect(xAccount).toHaveProperty("deleteTweetsRetweetsThresholdEnabled");
  expect(xAccount).toHaveProperty("deleteTweetsRetweetsThreshold");
  expect(xAccount).toHaveProperty("deleteRetweets");
  expect(xAccount).toHaveProperty("deleteRetweetsDaysOld");
  expect(xAccount).toHaveProperty("deleteLikes");
  expect(xAccount).toHaveProperty("deleteDMs");
});

test("saveXAccount should update an existing XAccount", () => {
  const xAccount = database.createXAccount();
  xAccount.username = "newUsername";
  database.saveXAccount(xAccount);

  const db = database.getMainDatabase();
  const result = database.exec(
    db,
    "SELECT * FROM xAccount WHERE id = ?",
    [xAccount.id],
    "get",
  );
  expect(result).toEqual(expect.objectContaining({ username: "newUsername" }));
});

test("getXAccount should retrieve the correct XAccount", () => {
  const xAccount = database.createXAccount();
  database.saveXAccount(xAccount);

  const retrievedAccount = database.getXAccount(xAccount.id);
  expect(retrievedAccount).toEqual(xAccount);
});

test("getXAccounts should retrieve all XAccounts", () => {
  const xAccount1 = database.createXAccount();
  const xAccount2 = database.createXAccount();
  database.saveXAccount(xAccount1);
  database.saveXAccount(xAccount2);

  const accounts = database.getXAccounts();
  expect(accounts).toEqual(expect.arrayContaining([xAccount1, xAccount2]));
});

test("createBlueskyAccount should create a new Bluesky local account", () => {
  const blueskyAccount = database.createBlueskyAccount();
  expect(blueskyAccount).toHaveProperty("id");
  expect(blueskyAccount).toHaveProperty("createdAt");
  expect(blueskyAccount).toHaveProperty("updatedAt");
  expect(blueskyAccount).toHaveProperty("accessedAt");
  // A new local account has no Bluesky identity until it connects, and its
  // profile data starts empty.
  expect(blueskyAccount.did).toBeNull();
  expect(blueskyAccount.handle).toBeNull();
  expect(blueskyAccount.displayName).toBeNull();
  expect(blueskyAccount.profileImageDataURI).toBeNull();
});

test("the dormant Bluesky model's settings are gone", () => {
  const columns = database.exec(
    database.getMainDatabase(),
    "PRAGMA table_info(blueskyAccount);",
    [],
    "all",
  ) as { name: string }[];
  const columnNames = columns.map((column) => column.name);

  expect(columnNames).not.toContain("username");
  expect(columnNames).not.toContain("archivePostsHTML");
  expect(columnNames).not.toContain("deletePostsLikesThreshold");
  expect(columnNames).not.toContain("likesCount");
});

test("a Bluesky identity can belong to only one local account", () => {
  const first = database.createBlueskyAccount();
  first.did = "did:plc:examplealice";
  database.saveBlueskyAccount(first);

  const second = database.createBlueskyAccount();
  second.did = "did:plc:examplealice";
  expect(() => database.saveBlueskyAccount(second)).toThrow();

  // Local accounts that have never connected have no DID, and any number of
  // them may exist at once.
  const third = database.createBlueskyAccount();
  expect(third.did).toBeNull();
  expect(() => database.saveBlueskyAccount(third)).not.toThrow();
});

test("getBlueskyAccountByDID finds the local account for a Bluesky identity", () => {
  const account = database.createBlueskyAccount();
  account.did = "did:plc:examplebob";
  account.handle = "bob.bsky.social";
  database.saveBlueskyAccount(account);

  expect(database.getBlueskyAccountByDID("did:plc:examplebob")?.id).toEqual(
    account.id,
  );
  expect(database.getBlueskyAccountByDID("did:plc:nobody")).toBeNull();
});

test("createFacebookAccount should create a new FacebookAccount", () => {
  const facebookAccount = database.createFacebookAccount();
  expect(facebookAccount).toHaveProperty("id");
  expect(facebookAccount).toHaveProperty("createdAt");
  expect(facebookAccount).toHaveProperty("updatedAt");
  expect(facebookAccount).toHaveProperty("accessedAt");
  expect(facebookAccount).toHaveProperty("username");
  expect(facebookAccount).toHaveProperty("profileImageDataURI");
  expect(facebookAccount).toHaveProperty("accountID");
});

test("saveBlueskyAccount should update mutable profile data", () => {
  const blueskyAccount = database.createBlueskyAccount();
  blueskyAccount.handle = "alice.bsky.social";
  blueskyAccount.displayName = "Alice";
  database.saveBlueskyAccount(blueskyAccount);

  const db = database.getMainDatabase();
  const result = database.exec(
    db,
    "SELECT * FROM blueskyAccount WHERE id = ?",
    [blueskyAccount.id],
    "get",
  );
  expect(result).toEqual(
    expect.objectContaining({
      handle: "alice.bsky.social",
      displayName: "Alice",
    }),
  );
});

test("saveFacebookAccount should update an existing FacebookAccount", () => {
  const facebookAccount = database.createFacebookAccount();
  facebookAccount.username = "updatedFacebook";
  facebookAccount.accountID = "fb-123";
  database.saveFacebookAccount(facebookAccount);

  const db = database.getMainDatabase();
  const result = database.exec(
    db,
    "SELECT * FROM facebookAccount WHERE id = ?",
    [facebookAccount.id],
    "get",
  );
  expect(result).toEqual(
    expect.objectContaining({
      username: "updatedFacebook",
      accountID: "fb-123",
    }),
  );
});

test("getBlueskyAccount should retrieve the correct Bluesky local account", () => {
  const blueskyAccount = database.createBlueskyAccount();
  database.saveBlueskyAccount(blueskyAccount);

  const retrievedAccount = database.getBlueskyAccount(blueskyAccount.id);
  expect(retrievedAccount).toEqual(blueskyAccount);
});

test("getBlueskyAccounts should retrieve all Bluesky local accounts", () => {
  const blueskyAccount1 = database.createBlueskyAccount();
  const blueskyAccount2 = database.createBlueskyAccount();
  database.saveBlueskyAccount(blueskyAccount1);
  database.saveBlueskyAccount(blueskyAccount2);

  const accounts = database.getBlueskyAccounts();
  expect(accounts).toEqual(
    expect.arrayContaining([blueskyAccount1, blueskyAccount2]),
  );
});

test("getFacebookAccount should retrieve the correct FacebookAccount", () => {
  const facebookAccount = database.createFacebookAccount();
  database.saveFacebookAccount(facebookAccount);

  const retrievedAccount = database.getFacebookAccount(facebookAccount.id);
  expect(retrievedAccount).toEqual(facebookAccount);
});

test("getFacebookAccounts should retrieve all FacebookAccounts", () => {
  const facebookAccount1 = database.createFacebookAccount();
  const facebookAccount2 = database.createFacebookAccount();
  database.saveFacebookAccount(facebookAccount1);
  database.saveFacebookAccount(facebookAccount2);

  const accounts = database.getFacebookAccounts();
  expect(accounts).toEqual(
    expect.arrayContaining([facebookAccount1, facebookAccount2]),
  );
});

test("createAccount should create a new Account", () => {
  const account = database.createAccount();
  expect(account).toHaveProperty("id");
  expect(account).toHaveProperty("type");
  expect(account).toHaveProperty("sortOrder");
  expect(account).toHaveProperty("xAccount");
  expect(account).toHaveProperty("uuid");
});

test("selectAccountType should set the account type and create a new xAccount", () => {
  const account = database.createAccount();
  const updatedAccount = database.selectAccountType(account.id, "X");
  expect(updatedAccount.type).toBe("X");
  expect(updatedAccount.xAccount).not.toBeNull();
});

test("saveAccount should update an existing Account", () => {
  const account = database.createAccount();
  account.type = "X";
  database.saveAccount(account);

  const db = database.getMainDatabase();
  const result = database.exec(
    db,
    "SELECT * FROM account WHERE id = ?",
    [account.id],
    "get",
  );
  expect(result).toEqual(expect.objectContaining({ type: "X" }));
});

test("getAccount should retrieve the correct Account", () => {
  const account = database.createAccount();
  database.saveAccount(account);

  const retrievedAccount = database.getAccount(account.id);
  expect(retrievedAccount).toEqual(account);
});

test("getAccounts should retrieve all Accounts", () => {
  const account1 = database.createAccount();
  const account2 = database.createAccount();
  database.saveAccount(account1);
  database.saveAccount(account2);

  const accounts = database.getAccounts();
  expect(accounts).toEqual(expect.arrayContaining([account1, account2]));
});

test("deleteAccount should delete the specified Account", () => {
  const account = database.createAccount();
  database.saveAccount(account);
  database.deleteAccount(account.id);

  const db = database.getMainDatabase();
  const result = database.exec(
    db,
    "SELECT * FROM account WHERE id = ?",
    [account.id],
    "get",
  );
  expect(result).toBeUndefined();
});

test("getAccountUsername should retrieve the correct username", async () => {
  let account = database.createAccount();
  account = database.selectAccountType(account.id, "X");
  expect(account.xAccount).not.toBeNull();
  if (account.xAccount) {
    account.xAccount.username = "testUsername";
  }
  database.saveAccount(account);

  const username = await database.getAccountUsername(account);
  expect(username).toBe("testUsername");
});

test("create, delete, and verify accounts", () => {
  // Step 1: Create 3 accounts and select X as the type for each of them
  let account1 = database.createAccount();
  account1 = database.selectAccountType(account1.id, "X");
  let account2 = database.createAccount();
  account2 = database.selectAccountType(account2.id, "X");
  let account3 = database.createAccount();
  account3 = database.selectAccountType(account3.id, "X");

  // Step 2: Check that their database IDs are 1, 2, and 3
  expect(account1.id).toBe(1);
  expect(account2.id).toBe(2);
  expect(account3.id).toBe(3);

  // Step 3: Delete the account with ID 2
  database.deleteAccount(2);

  // Step 4: Ensure that the database only has accounts with IDs 1 and 3
  let accounts = database.getAccounts();
  let accountIds = accounts.map((account) => account.id);
  expect(accountIds).toEqual(expect.arrayContaining([1, 3]));
  expect(accountIds).not.toContain(2);

  // Step 5: Create another account and select X type
  const account4 = database.createAccount();
  database.selectAccountType(account4.id, "X");

  // Step 6: Ensure that the database has accounts with IDs 1, 3, and 4
  accounts = database.getAccounts();
  accountIds = accounts.map((account) => account.id);
  expect(accountIds).toEqual(expect.arrayContaining([1, 3, 4]));
});

// Tests for error report functions

test("createErrorReport should create a new error report", () => {
  const accountID = 1;
  const accountType = "X";
  const errorReportType = "X_manualBugReport";
  const errorReportData = '{"test": "data"}';
  const accountUsername = "testUsername";
  const screenshotDataURI = "testScreenshotDataURI";
  const sensitiveContextData = '{"test": "sensitive data"}';

  database.createErrorReport(
    accountID,
    accountType,
    errorReportType,
    errorReportData,
    accountUsername,
    screenshotDataURI,
    sensitiveContextData,
  );

  const db = database.getMainDatabase();
  const result: database.ErrorReportRow = database.exec(
    db,
    "SELECT * FROM errorReport WHERE accountType = ? AND errorReportType = ?",
    [accountType, errorReportType],
    "get",
  ) as database.ErrorReportRow;
  expect(result.accountID).toBe(accountID);
  expect(result.accountType).toBe(accountType);
  expect(result.errorReportType).toBe(errorReportType);
  expect(result.errorReportData).toBe(errorReportData);
  expect(result.accountUsername).toBe(accountUsername);
  expect(result.screenshotDataURI).toBe(screenshotDataURI);
  expect(result.sensitiveContextData).toBe(sensitiveContextData);
  expect(result.status).toBe("new");
});

test("getErrorReport should retrieve the correct error report", () => {
  const accountID = 1;
  const accountType = "X";
  const errorReportType = "X_manualBugReport";
  const errorReportData = '{"test": "data"}';
  const accountUsername = "testUsername";
  const screenshotDataURI = "testScreenshotDataURI";
  const sensitiveContextData = '{"test": "sensitive data"}';

  database.createErrorReport(
    accountID,
    accountType,
    errorReportType,
    errorReportData,
    accountUsername,
    screenshotDataURI,
    sensitiveContextData,
  );
  const db = database.getMainDatabase();
  const result: database.ErrorReportRow = database.exec(
    db,
    "SELECT id FROM errorReport WHERE accountType = ? AND errorReportType = ?",
    [accountType, errorReportType],
    "get",
  ) as database.ErrorReportRow;
  const errorReport = database.getErrorReport(result.id);

  expect(errorReport?.accountID).toBe(accountID);
  expect(errorReport?.accountType).toBe(accountType);
  expect(errorReport?.errorReportType).toBe(errorReportType);
  expect(errorReport?.errorReportData).toBe(errorReportData);
  expect(errorReport?.accountUsername).toBe(accountUsername);
  expect(errorReport?.screenshotDataURI).toBe(screenshotDataURI);
  expect(errorReport?.sensitiveContextData).toBe(sensitiveContextData);
  expect(errorReport?.status).toBe("new");
});

test("getNewErrorReports should retrieve all new error reports", () => {
  const accountID = 1;
  const accountType = "X";
  const errorReportType = "X_manualBugReport";
  const errorReportData = '{"test": "data"}';
  const accountUsername = "testUsername";
  const screenshotDataURI = "testScreenshotDataURI";
  const sensitiveContextData = '{"test": "sensitive data"}';

  const accountType2 = "Y";
  const errorReportType2 = "Y_manualBugReport";
  const errorReportData2 = '{"test": "data2"}';
  const accountUsername2 = "testUsername2";
  const screenshotDataURI2 = "testScreenshotDataURI2";
  const sensitiveContextData2 = '{"test": "sensitive data2"}';

  database.createErrorReport(
    accountID,
    accountType,
    errorReportType,
    errorReportData,
    accountUsername,
    screenshotDataURI,
    sensitiveContextData,
  );
  database.createErrorReport(
    accountID,
    accountType2,
    errorReportType2,
    errorReportData2,
    accountUsername2,
    screenshotDataURI2,
    sensitiveContextData2,
  );

  const newErrorReports = database.getNewErrorReports(accountID);
  expect(newErrorReports.length).toEqual(2);
  expect(newErrorReports[0].accountID).toBe(accountID);
  expect(newErrorReports[0].accountType).toBe(accountType);
  expect(newErrorReports[0].errorReportType).toBe(errorReportType);
  expect(newErrorReports[0].errorReportData).toBe(errorReportData);
  expect(newErrorReports[0].accountUsername).toBe(accountUsername);
  expect(newErrorReports[0].screenshotDataURI).toBe(screenshotDataURI);
  expect(newErrorReports[0].sensitiveContextData).toBe(sensitiveContextData);
  expect(newErrorReports[0].status).toBe("new");
  expect(newErrorReports[1].accountID).toBe(accountID);
  expect(newErrorReports[1].accountType).toBe(accountType2);
  expect(newErrorReports[1].errorReportType).toBe(errorReportType2);
  expect(newErrorReports[1].errorReportData).toBe(errorReportData2);
  expect(newErrorReports[1].accountUsername).toBe(accountUsername2);
  expect(newErrorReports[1].screenshotDataURI).toBe(screenshotDataURI2);
  expect(newErrorReports[1].sensitiveContextData).toBe(sensitiveContextData2);
  expect(newErrorReports[1].status).toBe("new");
});

test("updateErrorReportSubmitted should delete an error report", () => {
  const accountID = 1;
  const accountType = "X";
  const errorReportType = "X_manualBugReport";
  const errorReportData = '{"test": "data"}';
  const accountUsername = "testUsername";
  const screenshotDataURI = "testScreenshotDataURI";
  const sensitiveContextData = '{"test": "sensitive data"}';

  database.createErrorReport(
    accountID,
    accountType,
    errorReportType,
    errorReportData,
    accountUsername,
    screenshotDataURI,
    sensitiveContextData,
  );
  const db = database.getMainDatabase();
  const result: database.ErrorReportRow = database.exec(
    db,
    "SELECT * FROM errorReport WHERE accountType = ? AND errorReportType = ?",
    [accountType, errorReportType],
    "get",
  ) as database.ErrorReportRow;
  database.updateErrorReportSubmitted(result.id);

  const updatedReport = database.getErrorReport(result.id);
  expect(updatedReport).toBe(null);
});

test("dismissNewErrorReports should delete all new error reports", () => {
  const accountID = 1;
  const accountType = "X";
  const errorReportType = "X_manualBugReport";
  const errorReportData = '{"test": "data"}';
  const accountUsername = "testUsername";
  const screenshotDataURI = "testScreenshotDataURI";
  const sensitiveContextData = '{"test": "sensitive data"}';

  database.createErrorReport(
    accountID,
    accountType,
    errorReportType,
    errorReportData,
    accountUsername,
    screenshotDataURI,
    sensitiveContextData,
  );
  database.dismissNewErrorReports(accountID);

  const newErrorReports = database.getNewErrorReports(accountID);
  expect(newErrorReports.length).toBe(0);
});

test("createErrorReport should create a new error report with optional parameters", () => {
  const accountID = 1;
  const accountType = "testAccountType";
  const errorReportType = "testErrorReportType";
  const errorReportData = "testErrorReportData";

  // Create an error report without optional parameters
  database.createErrorReport(
    accountID,
    accountType,
    errorReportType,
    errorReportData,
    null,
    null,
    null,
  );

  const db = database.getMainDatabase();
  const row: database.ErrorReportRow = database.exec(
    db,
    "SELECT * FROM errorReport WHERE accountType = ? AND errorReportType = ?",
    [accountType, errorReportType],
    "get",
  ) as database.ErrorReportRow;

  expect(row.accountID).toBe(accountID);
  expect(row.accountType).toBe(accountType);
  expect(row.errorReportType).toBe(errorReportType);
  expect(row.errorReportData).toBe(errorReportData);
  expect(row.accountUsername).toBeNull();
  expect(row.screenshotDataURI).toBeNull();
  expect(row.sensitiveContextData).toBeNull();
  expect(row.status).toBe("new");
});

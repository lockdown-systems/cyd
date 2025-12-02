import fs from "fs";
import path from "path";

import { beforeEach, afterEach, test, expect, vi } from "vitest";

// Mock the helpers module
vi.mock("./util", () => ({
  ...vi.importActual("./util"), // Import and spread the actual implementations
  getSettingsPath: vi.fn(() => {
    const settingsPath = path.join(
      __dirname,
      "..",
      "testdata",
      "settingsPath-database",
    );
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

test("createBlueskyAccount should create a new BlueskyAccount", () => {
  const blueskyAccount = database.createBlueskyAccount();
  expect(blueskyAccount).toHaveProperty("id");
  expect(blueskyAccount).toHaveProperty("createdAt");
  expect(blueskyAccount).toHaveProperty("updatedAt");
  expect(blueskyAccount).toHaveProperty("accessedAt");
  expect(blueskyAccount).toHaveProperty("username");
  expect(blueskyAccount).toHaveProperty("profileImageDataURI");
  expect(blueskyAccount).toHaveProperty("saveMyData");
  expect(blueskyAccount).toHaveProperty("deleteMyData");
  expect(blueskyAccount).toHaveProperty("archivePosts");
  expect(blueskyAccount).toHaveProperty("archivePostsHTML");
  expect(blueskyAccount).toHaveProperty("archiveLikes");
  expect(blueskyAccount).toHaveProperty("deletePosts");
  expect(blueskyAccount).toHaveProperty("deletePostsDaysOld");
  expect(blueskyAccount).toHaveProperty("deletePostsDaysOldEnabled");
  expect(blueskyAccount).toHaveProperty("deletePostsLikesThresholdEnabled");
  expect(blueskyAccount).toHaveProperty("deletePostsLikesThreshold");
  expect(blueskyAccount).toHaveProperty("deletePostsRepostsThresholdEnabled");
  expect(blueskyAccount).toHaveProperty("deletePostsRepostsThreshold");
  expect(blueskyAccount).toHaveProperty("deleteReposts");
  expect(blueskyAccount).toHaveProperty("deleteRepostsDaysOld");
  expect(blueskyAccount).toHaveProperty("deleteRepostsDaysOldEnabled");
  expect(blueskyAccount).toHaveProperty("deleteLikes");
  expect(blueskyAccount).toHaveProperty("deleteLikesDaysOld");
  expect(blueskyAccount).toHaveProperty("deleteLikesDaysOldEnabled");
  expect(blueskyAccount).toHaveProperty("followingCount");
  expect(blueskyAccount).toHaveProperty("followersCount");
  expect(blueskyAccount).toHaveProperty("postsCount");
  expect(blueskyAccount).toHaveProperty("likesCount");
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

test("saveBlueskyAccount should update an existing BlueskyAccount", () => {
  const blueskyAccount = database.createBlueskyAccount();
  blueskyAccount.username = "newUsername";
  database.saveBlueskyAccount(blueskyAccount);

  const db = database.getMainDatabase();
  const result = database.exec(
    db,
    "SELECT * FROM blueskyAccount WHERE id = ?",
    [blueskyAccount.id],
    "get",
  );
  expect(result).toEqual(expect.objectContaining({ username: "newUsername" }));
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

test("getBlueskyAccount should retrieve the correct BlueskyAccount", () => {
  const blueskyAccount = database.createBlueskyAccount();
  database.saveBlueskyAccount(blueskyAccount);

  const retrievedAccount = database.getBlueskyAccount(blueskyAccount.id);
  expect(retrievedAccount).toEqual(blueskyAccount);
});

test("getBlueskyAccounts should retrieve all BlueskyAccounts", () => {
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

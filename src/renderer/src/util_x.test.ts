import { test, expect } from "vitest";
import { XAccount } from "../../shared_types";

import * as UtilX from "./util_x";
import { setJobsType } from "./util";

const localStorageMock = (() => {
  let store: { [key: string]: string } = {};

  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value;
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();

Object.defineProperty(window, "localStorage", {
  value: localStorageMock,
});

function createXAccountFromDefaults(changes: object) {
  return {
    id: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
    accessedAt: new Date(),
    username: "test",
    userID: "",
    profileImageDataURI: "",
    importFromArchive: false,
    saveMyData: false,
    deleteMyData: false,
    archiveMyData: false,
    archiveTweets: false,
    archiveTweetsHTML: false,
    archiveLikes: false,
    archiveBookmarks: false,
    archiveDMs: false,
    deleteTweets: false,
    deleteTweetsDaysOldEnabled: false,
    deleteTweetsDaysOld: 0,
    deleteTweetsLikesThresholdEnabled: false,
    deleteTweetsLikesThreshold: 0,
    deleteTweetsRetweetsThresholdEnabled: false,
    deleteTweetsRetweetsThreshold: 0,
    deleteRetweets: false,
    deleteRetweetsDaysOldEnabled: false,
    deleteRetweetsDaysOld: 0,
    deleteLikes: false,
    deleteBookmarks: false,
    deleteDMs: false,
    unfollowEveryone: false,
    followingCount: 0,
    followersCount: 0,
    tweetsCount: 0,
    likesCount: 0,
    ...changes,
  };
}

const accountID = 1;

test("UtilX.xRequiresPremium() returns false when saving", async () => {
  const xAccount: XAccount = createXAccountFromDefaults({
    // Save everything
    archiveTweets: true,
    archiveTweetsHTML: true,
    archiveLikes: true,
    archiveBookmarks: true,
    archiveDMs: true,
  });
  setJobsType(accountID, "save");
  expect(await UtilX.xRequiresPremium(accountID, xAccount)).toBe(false);
});

test("UtilX.xRequiresPremium() returns false when archiving", async () => {
  const xAccount: XAccount = createXAccountFromDefaults({
    // Save everything
    archiveTweetsHTML: true,
    archiveBookmarks: true,
    archiveDMs: true,
  });
  setJobsType(accountID, "archive");
  expect(await UtilX.xRequiresPremium(accountID, xAccount)).toBe(false);
});

test("UtilX.xRequiresPremium() returns false for only deleting tweets and retweets", async () => {
  const xAccount: XAccount = createXAccountFromDefaults({
    // Only delete tweets and retweets, no other settings
    deleteTweets: true,
    deleteRetweets: true,
    deleteTweetsDaysOldEnabled: false,
    deleteTweetsLikesThresholdEnabled: false,
    deleteTweetsRetweetsThresholdEnabled: false,
    deleteRetweetsDaysOldEnabled: false,
    deleteLikes: false,
    deleteBookmarks: false,
    deleteDMs: false,
    unfollowEveryone: false,
  });
  setJobsType(accountID, "delete");
  expect(await UtilX.xRequiresPremium(accountID, xAccount)).toBe(false);
});

test("UtilX.xRequiresPremium() returns true when choosing any delete options", async () => {
  const deleteOptions = [
    "deleteTweetsDaysOldEnabled",
    "deleteTweetsLikesThresholdEnabled",
    "deleteTweetsRetweetsThresholdEnabled",
    "deleteRetweetsDaysOldEnabled",
    "deleteLikes",
    "deleteBookmarks",
    "deleteDMs",
    "unfollowEveryone",
  ];
  for (const option of deleteOptions) {
    const xAccount: XAccount = createXAccountFromDefaults({
      // delete tweets and retweets
      deleteTweets: true,
      deleteRetweets: true,
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (xAccount as any)[option] = true;

    setJobsType(accountID, "delete");

    // Check if the account requires premium
    const requiresPremium = await UtilX.xRequiresPremium(accountID, xAccount);
    console.log(`option: ${option}, requiresPremium: ${requiresPremium}`);
    expect(requiresPremium).toBe(true);
  }
});

test("UtilX.xRequiresPremium() returns true for migrating to Bluesky", async () => {
  const xAccount: XAccount = createXAccountFromDefaults({});
  setJobsType(accountID, "migrateBluesky");
  expect(await UtilX.xRequiresPremium(accountID, xAccount)).toBe(true);
});

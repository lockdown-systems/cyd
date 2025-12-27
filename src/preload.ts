import { contextBridge, ipcRenderer, FileFilter } from "electron";
import {
  ErrorReport,
  Account,
  ResponseData,
  ArchiveInfo,
  BlueskyMigrationProfile,
  // X
  XJob,
  XProgress,
  XArchiveStartResponse,
  XIndexMessagesStartResponse,
  XDeleteTweetsStartResponse,
  XRateLimitInfo,
  XProgressInfo,
  XDatabaseStats,
  XDeleteReviewStats,
  XImportArchiveResponse,
  XMigrateTweetCounts,
  XAccount,
  // Facebook
  FacebookJob,
  FacebookProgressInfo,
  FacebookRateLimitInfo,
} from "./shared_types";

const electronAPI = {
  // Export ipcRenderer to the frontend
  ipcRenderer: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    send: (channel: string, ...args: any[]) => ipcRenderer.send(channel, args),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    on: (channel: string, func: (...args: any[]) => void) =>
      ipcRenderer.on(channel, (event, ...args) => func(event, ...args)),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    once: (channel: string, func: (...args: any[]) => void) =>
      ipcRenderer.once(channel, (event, ...args) => func(event, ...args)),
    removeAllListeners: (channel: string) =>
      ipcRenderer.removeAllListeners(channel),
  },

  // Global functions
  checkForUpdates: () => {
    ipcRenderer.invoke("checkForUpdates");
  },
  quitAndInstallUpdate: () => {
    ipcRenderer.invoke("quitAndInstallUpdate");
  },
  getVersion: (): Promise<string> => {
    return ipcRenderer.invoke("getVersion");
  },
  getMode: (): Promise<string> => {
    return ipcRenderer.invoke("getMode");
  },
  getPlatform: (): Promise<string> => {
    return ipcRenderer.invoke("getPlatform");
  },
  getAPIURL: (): Promise<string> => {
    return ipcRenderer.invoke("getAPIURL");
  },
  getDashURL: (): Promise<string> => {
    return ipcRenderer.invoke("getDashURL");
  },
  isFeatureEnabled: (feature: string): Promise<boolean> => {
    return ipcRenderer.invoke("isFeatureEnabled", feature);
  },
  trackEvent: (eventName: string, userAgent: string): Promise<string> => {
    return ipcRenderer.invoke("trackEvent", eventName, userAgent);
  },
  shouldOpenDevtools: (): Promise<boolean> => {
    return ipcRenderer.invoke("shouldOpenDevtools");
  },
  showMessage: (message: string, detail: string) => {
    ipcRenderer.invoke("showMessage", message, detail);
  },
  showError: (message: string) => {
    ipcRenderer.invoke("showError", message);
  },
  showQuestion: (
    message: string,
    trueText: string,
    falseText: string,
  ): Promise<boolean> => {
    return ipcRenderer.invoke("showQuestion", message, trueText, falseText);
  },
  showOpenDialog: (
    selectFolders: boolean,
    selectFiles: boolean,
    fileFilters: FileFilter[] | undefined = undefined,
  ): Promise<string | null> => {
    return ipcRenderer.invoke(
      "showOpenDialog",
      selectFolders,
      selectFiles,
      fileFilters,
    );
  },
  openURL: (url: string) => {
    ipcRenderer.invoke("openURL", url);
  },
  loadFileInWebview: (webContentsId: number, filename: string) => {
    ipcRenderer.invoke("loadFileInWebview", webContentsId, filename);
  },
  getAccountDataPath: (
    accountID: number,
    filename: string,
  ): Promise<string | null> => {
    return ipcRenderer.invoke("getAccountDataPath", accountID, filename);
  },
  startPowerSaveBlocker: (accountID: number): Promise<number> => {
    return ipcRenderer.invoke("startPowerSaveBlocker", accountID);
  },
  stopPowerSaveBlocker: (accountID: number, powerSaveBlockerID: number) => {
    ipcRenderer.invoke("stopPowerSaveBlocker", accountID, powerSaveBlockerID);
  },
  deleteSettingsAndRestart: () => {
    ipcRenderer.invoke("deleteSettingsAndRestart");
  },
  onPowerMonitorSuspend: (callback: () => void) => {
    ipcRenderer.on("powerMonitor:suspend", callback);
  },
  onPowerMonitorResume: (callback: () => void) => {
    ipcRenderer.on("powerMonitor:resume", callback);
  },
  getImageDataURIFromFile: (filename: string): Promise<string> => {
    return ipcRenderer.invoke("getImageDataURIFromFile", filename);
  },

  // Database functions
  database: {
    getConfig: (key: string): Promise<string | null> => {
      return ipcRenderer.invoke("database:getConfig", key);
    },
    setConfig: (key: string, value: string) => {
      ipcRenderer.invoke("database:setConfig", key, value);
    },
    deleteConfig: (key: string) => {
      ipcRenderer.invoke("database:deleteConfig", key);
    },
    deleteConfigLike: (key: string) => {
      ipcRenderer.invoke("database:deleteConfigLike", key);
    },
    getErrorReport: (id: number): Promise<ErrorReport | null> => {
      return ipcRenderer.invoke("database:getErrorReport", id);
    },
    getNewErrorReports: (accountID: number): Promise<ErrorReport[]> => {
      return ipcRenderer.invoke("database:getNewErrorReports", accountID);
    },
    createErrorReport: (
      accountID: number,
      accountType: string,
      errorReportType: string,
      errorReportData: string,
      accountUsername: string | null,
      screenshotDataURI: string | null,
      sensitiveContextData: string | null,
    ): Promise<void> => {
      return ipcRenderer.invoke(
        "database:createErrorReport",
        accountID,
        accountType,
        errorReportType,
        errorReportData,
        accountUsername,
        screenshotDataURI,
        sensitiveContextData,
      );
    },
    updateErrorReportSubmitted: (id: number) => {
      ipcRenderer.invoke("database:updateErrorReportSubmitted", id);
    },
    dismissNewErrorReports: (accountID: number) => {
      ipcRenderer.invoke("database:dismissNewErrorReports", accountID);
    },
    getAccount: (accountID: number): Promise<Account | null> => {
      return ipcRenderer.invoke("database:getAccount", accountID);
    },
    getAccounts: (): Promise<Account[]> => {
      return ipcRenderer.invoke("database:getAccounts");
    },
    createAccount: (): Promise<Account> => {
      return ipcRenderer.invoke("database:createAccount");
    },
    selectAccountType: (accountID: number, type: string): Promise<Account> => {
      return ipcRenderer.invoke("database:selectAccountType", accountID, type);
    },
    saveAccount: (accountJSON: string) => {
      ipcRenderer.invoke("database:saveAccount", accountJSON);
    },
    deleteAccount: (accountID: number) => {
      return ipcRenderer.invoke("database:deleteAccount", accountID);
    },
  },

  // Archive functions
  archive: {
    isPageAlreadySaved: (
      outputPath: string,
      basename: string,
    ): Promise<boolean> => {
      return ipcRenderer.invoke(
        "archive:isPageAlreadySaved",
        outputPath,
        basename,
      );
    },
    savePage: (
      webContentsID: number,
      outputPath: string,
      basename: string,
    ): Promise<boolean> => {
      return ipcRenderer.invoke(
        "archive:savePage",
        webContentsID,
        outputPath,
        basename,
      );
    },
    openFolder: (accountID: number, folderName: string) => {
      ipcRenderer.invoke("archive:openFolder", accountID, folderName);
    },
    getInfo: (accountID: number): Promise<ArchiveInfo> => {
      return ipcRenderer.invoke("archive:getInfo", accountID);
    },
  },

  // X functions
  X: {
    resetProgress: (accountID: number): Promise<XProgress> => {
      return ipcRenderer.invoke("X:resetProgress", accountID);
    },
    createJobs: (accountID: number, jobTypes: string[]): Promise<XJob[]> => {
      return ipcRenderer.invoke("X:createJobs", accountID, jobTypes);
    },
    getLastFinishedJob: (
      accountID: number,
      jobType: string,
    ): Promise<XJob | null> => {
      return ipcRenderer.invoke("X:getLastFinishedJob", accountID, jobType);
    },
    updateJob: (accountID: number, jobJSON: string) => {
      ipcRenderer.invoke("X:updateJob", accountID, jobJSON);
    },
    indexStart: (accountID: number) => {
      ipcRenderer.invoke("X:indexStart", accountID);
    },
    indexStop: (accountID: number) => {
      ipcRenderer.invoke("X:indexStop", accountID);
    },
    indexParseTweets: (accountID: number): Promise<XProgress> => {
      return ipcRenderer.invoke("X:indexParseTweets", accountID);
    },
    indexParseLikes: (accountID: number): Promise<XProgress> => {
      return ipcRenderer.invoke("X:indexParseLikes", accountID);
    },
    indexParseBookmarks: (accountID: number): Promise<XProgress> => {
      return ipcRenderer.invoke("X:indexParseBookmarks", accountID);
    },
    indexParseConversations: (accountID: number): Promise<XProgress> => {
      return ipcRenderer.invoke("X:indexParseConversations", accountID);
    },
    indexIsThereMore: (accountID: number): Promise<boolean> => {
      return ipcRenderer.invoke("X:indexIsThereMore", accountID);
    },
    resetThereIsMore: (accountID: number) => {
      ipcRenderer.invoke("X:resetThereIsMore", accountID);
    },
    indexMessagesStart: (
      accountID: number,
    ): Promise<XIndexMessagesStartResponse> => {
      return ipcRenderer.invoke("X:indexMessagesStart", accountID);
    },
    indexParseMessages: (accountID: number): Promise<XProgress> => {
      return ipcRenderer.invoke("X:indexParseMessages", accountID);
    },
    indexConversationFinished: (
      accountID: number,
      conversationID: string,
    ): Promise<void> => {
      return ipcRenderer.invoke(
        "X:indexConversationFinished",
        accountID,
        conversationID,
      );
    },
    archiveTweetsStart: (accountID: number): Promise<XArchiveStartResponse> => {
      return ipcRenderer.invoke("X:archiveTweetsStart", accountID);
    },
    archiveTweetsOutputPath: (accountID: number): Promise<string> => {
      return ipcRenderer.invoke("X:archiveTweetsOutputPath", accountID);
    },
    archiveTweet: (accountID: number, tweetID: string): Promise<void> => {
      return ipcRenderer.invoke("X:archiveTweet", accountID, tweetID);
    },
    archiveTweetCheckDate: (
      accountID: number,
      tweetID: string,
    ): Promise<void> => {
      return ipcRenderer.invoke("X:archiveTweetCheckDate", accountID, tweetID);
    },
    archiveBuild: (accountID: number): Promise<void> => {
      return ipcRenderer.invoke("X:archiveBuild", accountID);
    },
    syncProgress: (accountID: number, progressJSON: string) => {
      ipcRenderer.invoke("X:syncProgress", accountID, progressJSON);
    },
    resetRateLimitInfo: (accountID: number): Promise<void> => {
      return ipcRenderer.invoke("X:resetRateLimitInfo", accountID);
    },
    isRateLimited: (accountID: number): Promise<XRateLimitInfo> => {
      return ipcRenderer.invoke("X:isRateLimited", accountID);
    },
    getProgress: (accountID: number): Promise<XProgress> => {
      return ipcRenderer.invoke("X:getProgress", accountID);
    },
    getProgressInfo: (accountID: number): Promise<XProgressInfo> => {
      return ipcRenderer.invoke("X:getProgressInfo", accountID);
    },
    getDatabaseStats: (accountID: number): Promise<XDatabaseStats> => {
      return ipcRenderer.invoke("X:getDatabaseStats", accountID);
    },
    getDeleteReviewStats: (accountID: number): Promise<XDeleteReviewStats> => {
      return ipcRenderer.invoke("X:getDeleteReviewStats", accountID);
    },
    saveProfileImage: (accountID: number, url: string): Promise<void> => {
      return ipcRenderer.invoke("X:saveProfileImage", accountID, url);
    },
    getLatestResponseData: (
      accountID: number,
    ): Promise<ResponseData | null> => {
      return ipcRenderer.invoke("X:getLatestResponseData", accountID);
    },
    deleteTweetsStart: (
      accountID: number,
    ): Promise<XDeleteTweetsStartResponse> => {
      return ipcRenderer.invoke("X:deleteTweetsStart", accountID);
    },
    deleteTweetsCountNotArchived: (
      accountID: number,
      total: boolean,
    ): Promise<number> => {
      return ipcRenderer.invoke(
        "X:deleteTweetsCountNotArchived",
        accountID,
        total,
      );
    },
    deleteRetweetsStart: (
      accountID: number,
    ): Promise<XDeleteTweetsStartResponse> => {
      return ipcRenderer.invoke("X:deleteRetweetsStart", accountID);
    },
    deleteLikesStart: (
      accountID: number,
    ): Promise<XDeleteTweetsStartResponse> => {
      return ipcRenderer.invoke("X:deleteLikesStart", accountID);
    },
    deleteBookmarksStart: (
      accountID: number,
    ): Promise<XDeleteTweetsStartResponse> => {
      return ipcRenderer.invoke("X:deleteBookmarksStart", accountID);
    },
    deleteTweet: (
      accountID: number,
      tweetID: string,
      deleteType: string,
    ): Promise<void> => {
      return ipcRenderer.invoke(
        "X:deleteTweet",
        accountID,
        tweetID,
        deleteType,
      );
    },
    deleteDMsMarkAllDeleted: (accountID: number): Promise<void> => {
      return ipcRenderer.invoke("X:deleteDMsMarkAllDeleted", accountID);
    },
    deleteDMsScrollToBottom: (accountID: number): Promise<void> => {
      return ipcRenderer.invoke("X:deleteDMsScrollToBottom", accountID);
    },
    unzipXArchive: (
      accountID: number,
      archivePath: string,
    ): Promise<string | null> => {
      return ipcRenderer.invoke("X:unzipXArchive", accountID, archivePath);
    },
    deleteUnzippedXArchive: (
      accountID: number,
      archivePath: string,
    ): Promise<string | null> => {
      return ipcRenderer.invoke(
        "X:deleteUnzippedXArchive",
        accountID,
        archivePath,
      );
    },
    verifyXArchive: (
      accountID: number,
      archivePath: string,
    ): Promise<string | null> => {
      return ipcRenderer.invoke("X:verifyXArchive", accountID, archivePath);
    },
    importXArchive: (
      accountID: number,
      archivePath: string,
      dataType: string,
    ): Promise<XImportArchiveResponse> => {
      return ipcRenderer.invoke(
        "X:importXArchive",
        accountID,
        archivePath,
        dataType,
      );
    },
    getCookie: (
      accountID: number,
      hostname: string,
      name: string,
    ): Promise<string | null> => {
      return ipcRenderer.invoke("X:getCookie", accountID, hostname, name);
    },
    getConfig: (accountID: number, key: string): Promise<string | null> => {
      return ipcRenderer.invoke("X:getConfig", accountID, key);
    },
    setConfig: (
      accountID: number,
      key: string,
      value: string,
    ): Promise<void> => {
      return ipcRenderer.invoke("X:setConfig", accountID, key, value);
    },
    deleteConfig: (accountID: number, key: string): Promise<void> => {
      return ipcRenderer.invoke("X:deleteConfig", accountID, key);
    },
    deleteConfigLike: (accountID: number, key: string): Promise<void> => {
      return ipcRenderer.invoke("X:deleteConfigLike", accountID, key);
    },
    getImageDataURI: (accountID: number, url: string): Promise<string> => {
      return ipcRenderer.invoke("X:getImageDataURI", accountID, url);
    },
    blueskyGetProfile: (
      accountID: number,
    ): Promise<BlueskyMigrationProfile | null> => {
      return ipcRenderer.invoke("X:blueskyGetProfile", accountID);
    },
    blueskyAuthorize: (
      accountID: number,
      handle: string,
    ): Promise<boolean | string> => {
      return ipcRenderer.invoke("X:blueskyAuthorize", accountID, handle);
    },
    blueskyCallback: (
      accountID: number,
      queryString: string,
    ): Promise<boolean | string> => {
      return ipcRenderer.invoke("X:blueskyCallback", accountID, queryString);
    },
    blueskyDisconnect: (accountID: number): Promise<void> => {
      return ipcRenderer.invoke("X:blueskyDisconnect", accountID);
    },
    blueskyGetTweetCounts: (
      accountID: number,
    ): Promise<XMigrateTweetCounts> => {
      return ipcRenderer.invoke("X:blueskyGetTweetCounts", accountID);
    },
    blueskyMigrateTweet: (
      accountID: number,
      tweetID: string,
    ): Promise<boolean | string> => {
      return ipcRenderer.invoke("X:blueskyMigrateTweet", accountID, tweetID);
    },
    blueskyDeleteMigratedTweet: (
      accountID: number,
      tweetID: string,
    ): Promise<boolean | string> => {
      return ipcRenderer.invoke(
        "X:blueskyDeleteMigratedTweet",
        accountID,
        tweetID,
      );
    },
    getMediaPath: (accountID: number): Promise<string> => {
      return ipcRenderer.invoke("X:getMediaPath", accountID);
    },
    initArchiveOnlyMode: (accountID: number): Promise<XAccount> => {
      return ipcRenderer.invoke("X:initArchiveOnlyMode", accountID);
    },
  },

  // Facebook functions
  Facebook: {
    createJobs: (
      accountID: number,
      jobTypes: string[],
    ): Promise<FacebookJob[]> => {
      return ipcRenderer.invoke("Facebook:createJobs", accountID, jobTypes);
    },
    getLastFinishedJob: (
      accountID: number,
      jobType: string,
    ): Promise<FacebookJob | null> => {
      return ipcRenderer.invoke(
        "Facebook:getLastFinishedJob",
        accountID,
        jobType,
      );
    },
    updateJob: (accountID: number, jobJSON: string) => {
      ipcRenderer.invoke("Facebook:updateJob", accountID, jobJSON);
    },
    getProgressInfo: (accountID: number): Promise<FacebookProgressInfo> => {
      return ipcRenderer.invoke("Facebook:getProgressInfo", accountID);
    },
    getConfig: (accountID: number, key: string): Promise<string | null> => {
      return ipcRenderer.invoke("Facebook:getConfig", accountID, key);
    },
    setConfig: (
      accountID: number,
      key: string,
      value: string,
    ): Promise<void> => {
      return ipcRenderer.invoke("Facebook:setConfig", accountID, key, value);
    },
    deleteConfig: (accountID: number, key: string): Promise<void> => {
      return ipcRenderer.invoke("Facebook:deleteConfig", accountID, key);
    },
    deleteConfigLike: (accountID: number, key: string): Promise<void> => {
      return ipcRenderer.invoke("Facebook:deleteConfigLike", accountID, key);
    },
    incrementTotalWallPostsDeleted: (
      accountID: number,
      count: number,
    ): Promise<void> => {
      return ipcRenderer.invoke(
        "Facebook:incrementTotalWallPostsDeleted",
        accountID,
        count,
      );
    },
    isRateLimited: (accountID: number): Promise<FacebookRateLimitInfo> => {
      return ipcRenderer.invoke("Facebook:isRateLimited", accountID);
    },
    resetRateLimitInfo: (accountID: number): Promise<void> => {
      return ipcRenderer.invoke("Facebook:resetRateLimitInfo", accountID);
    },
  },
};

contextBridge.exposeInMainWorld("electron", electronAPI);

export type ElectronAPI = typeof electronAPI;

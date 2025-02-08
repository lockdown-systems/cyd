import "bootstrap/dist/css/bootstrap.min.css";
import "bootstrap/dist/js/bootstrap.bundle.min.js";
import "@fortawesome/fontawesome-free/css/all.css";

import mitt from 'mitt';

import { createApp } from "vue";
import type {
    ErrorReport,
    Account,
    ResponseData,
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
    XArchiveInfo,
    XAccount,
    XImportArchiveResponse,
    // Facebook
    FacebookProgress,
    FacebookJob,
} from "../../shared_types";
import App from "./App.vue";

import { FileFilter } from "electron";

declare global {
    interface Window {
        electron: {
            checkForUpdates: () => Promise<void>;
            getVersion: () => Promise<string>;
            getMode: () => Promise<string>;
            getPlatform: () => Promise<string>;
            getAPIURL: () => Promise<string>;
            getDashURL: () => Promise<string>;
            trackEvent: (eventName: string, userAgent: string) => Promise<string>;
            shouldOpenDevtools: () => Promise<boolean>;
            showMessage: (message: string, detail: string) => Promise<void>;
            showError: (message: string) => Promise<void>;
            showQuestion: (message: string, trueText: string, falseText: string) => Promise<boolean>;
            showOpenDialog: (selectFolders: boolean, selectFiles: boolean, fileFilters: FileFilter[] | undefined) => Promise<string | null>;
            openURL: (url: string) => Promise<void>;
            loadFileInWebview: (webContentsId: number, filename: string) => Promise<void>;
            getAccountDataPath: (accountID: number, filename: string) => Promise<string | null>,
            startPowerSaveBlocker: () => Promise<number>;
            stopPowerSaveBlocker: (powerSaveBlockerID: number) => Promise<void>;
            deleteSettingsAndRestart: () => Promise<void>;
            database: {
                getConfig: (key: string) => Promise<string | null>;
                setConfig: (key: string, value: string) => Promise<void>;
                getErrorReport: (id: number) => Promise<ErrorReport | null>;
                getNewErrorReports: (accountID: number) => Promise<ErrorReport[]>;
                createErrorReport: (accountID: number, accountType: string, errorReportType: string, errorReportData: string, accountUsername: string | null, screenshotDataURI: string | null, sensitiveContextData: string | null) => Promise<void>;
                updateErrorReportSubmitted: (id: number) => Promise<void>;
                dismissNewErrorReports: (accountID: number) => Promise<void>;
                getAccount: (accountID: number) => Promise<Account | null>;
                getAccounts: () => Promise<Account[]>;
                createAccount: () => Promise<Account>;
                selectAccountType: (accountID: number, type: string) => Promise<Account>;
                saveAccount: (accountJSON: string) => Promise<void>;
                deleteAccount: (accountID: number) => Promise<void>;
            },
            archive: {
                isPageAlreadySaved: (outputPath: string, basename: string) => Promise<boolean>;
                savePage: (webContentsID: number, outputPath: string, basename: string) => Promise<boolean>;
            },
            X: {
                resetProgress: (accountID: number) => Promise<XProgress>;
                createJobs: (accountID: number, jobTypes: string[]) => Promise<XJob[]>;
                getLastFinishedJob: (accountID: number, jobType: string) => Promise<XJob | null>;
                updateJob: (accountID: number, jobJSON: string) => Promise<void>;
                indexStart: (accountID: number) => Promise<void>;
                indexStop: (accountID: number) => Promise<void>;
                indexParseAllJSON: (accountID: number) => Promise<XAccount>;
                indexParseTweets: (accountID: number) => Promise<XProgress>;
                indexParseConversations: (accountID: number) => Promise<XProgress>;
                indexIsThereMore: (accountID: number) => Promise<boolean>;
                resetThereIsMore: (accountID: number) => Promise<void>;
                indexMessagesStart: (accountID: number) => Promise<XIndexMessagesStartResponse>;
                indexParseMessages: (accountID: number) => Promise<XProgress>;
                indexConversationFinished: (accountID: number, conversationID: string) => Promise<void>;
                archiveTweetsStart: (accountID: number) => Promise<XArchiveStartResponse>;
                archiveTweetsOutputPath: (accountID: number) => Promise<string>;
                archiveTweet: (accountID: number, tweetID: string) => Promise<void>;
                archiveTweetCheckDate: (accountID: number, tweetID: string) => Promise<void>;
                archiveBuild: (accountID: number) => Promise<void>;
                syncProgress: (accountID: number, progressJSON: string) => Promise<void>;
                openFolder: (accountID: number, folderName: string) => Promise<void>;
                getArchiveInfo: (accountID: number) => Promise<XArchiveInfo>;
                resetRateLimitInfo: (accountID: number) => Promise<void>;
                isRateLimited: (accountID: number) => Promise<XRateLimitInfo>;
                getProgress: (accountID: number) => Promise<XProgress>;
                getProgressInfo: (accountID: number) => Promise<XProgressInfo>;
                getDatabaseStats: (accountID: number) => Promise<XDatabaseStats>;
                getDeleteReviewStats: (accountID: number) => Promise<XDeleteReviewStats>;
                saveProfileImage: (accountID: number, url: string) => Promise<void>;
                getLatestResponseData: (accountID: number) => Promise<ResponseData | null>;
                deleteTweetsStart: (accountID: number) => Promise<XDeleteTweetsStartResponse>;
                deleteTweetsCountNotArchived: (accountID: number, total: boolean) => Promise<number>;
                deleteRetweetsStart: (accountID: number) => Promise<XDeleteTweetsStartResponse>;
                deleteLikesStart: (accountID: number) => Promise<XDeleteTweetsStartResponse>;
                deleteBookmarksStart: (accountID: number) => Promise<XDeleteTweetsStartResponse>;
                deleteTweet: (accountID: number, tweetID: string, deleteType: string) => Promise<void>;
                deleteDMsMarkAllDeleted: (accountID: number) => Promise<void>;
                deleteDMsScrollToBottom: (accountID: number) => Promise<void>;
                unzipXArchive: (accountID: number, archivePath: string) => Promise<string | null>;
                deleteUnzippedXArchive: (accountID: number, archivePath: string) => Promise<string | null>;
                verifyXArchive: (accountID: number, archivePath: string) => Promise<string | null>;
                importXArchive: (accountID: number, archivePath: string, dataType: string) => Promise<XImportArchiveResponse>;
                getCookie: (accountID: number, name: string) => Promise<string | null>;
                getConfig: (accountID: number, key: string) => Promise<string | null>;
                setConfig: (accountID: number, key: string, value: string) => Promise<void>;
            };
            Facebook: {
                resetProgress: (accountID: number) => Promise<FacebookProgress>;
                createJobs: (accountID: number, jobTypes: string[]) => Promise<FacebookJob[]>;
                updateJob: (accountID: number, jobJSON: string) => Promise<void>;
                archiveBuild: (accountID: number) => Promise<void>;
                syncProgress: (accountID: number, progressJSON: string) => Promise<void>;
                getProgress: (accountID: number) => Promise<FacebookProgress>;
                getCookie: (accountID: number, name: string) => Promise<string | null>;
                getProfileImageDataURI: (accountID: number, profilePictureURI: string) => Promise<string>;
                getConfig: (accountID: number, key: string) => Promise<string | null>;
                setConfig: (accountID: number, key: string, value: string) => Promise<void>;
            },
            onPowerMonitorSuspend: (callback: () => void) => Promise<void>;
            onPowerMonitorResume: (callback: () => void) => Promise<void>;
        };
    }
}

const emitter = mitt();
const app = createApp(App);

app.config.globalProperties.emitter = emitter;
app.mount('#app');

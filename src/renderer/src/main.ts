import "bootstrap/dist/css/bootstrap.min.css";
import "bootstrap/dist/js/bootstrap.bundle.min.js";
import "@fortawesome/fontawesome-free/css/all.css";

import mitt from 'mitt';

import { createApp } from "vue";
import type {
    ErrorReport,
    Account,
    XProgress,
    XJob,
    XArchiveStartResponse,
    XIndexMessagesStartResponse,
    XDeleteTweetsStartResponse,
    XRateLimitInfo,
    XProgressInfo,
    XDatabaseStats,
    ResponseData,
    XDeleteReviewStats,
    XArchiveInfo,
    XAccount,
    XImportArchiveResponse,
    BlueskyMigrationProfile,
} from "../../shared_types";
import App from "./App.vue";

import { FileFilter } from "electron";

declare global {
    interface Window {
        electron: {
            ipcRenderer: {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                send: (channel: string, ...args: any[]) => void;
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                on: (channel: string, func: (...args: any[]) => void) => void;
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                once: (channel: string, func: (...args: any[]) => void) => void;
                removeAllListeners: (channel: string) => void;
            },
            checkForUpdates: () => void;
            getVersion: () => Promise<string>;
            getMode: () => Promise<string>;
            getPlatform: () => Promise<string>;
            getAPIURL: () => Promise<string>;
            getDashURL: () => Promise<string>;
            trackEvent: (eventName: string, userAgent: string) => Promise<string>;
            shouldOpenDevtools: () => Promise<boolean>;
            showMessage: (message: string) => void;
            showError: (message: string) => void;
            showQuestion: (message: string, trueText: string, falseText: string) => Promise<boolean>;
            showOpenDialog: (selectFolders: boolean, selectFiles: boolean, fileFilters: FileFilter[] | undefined) => Promise<string | null>;
            openURL: (url: string) => void;
            loadFileInWebview: (webContentsId: number, filename: string) => void;
            getAccountDataPath: (accountID: number, filename: string) => Promise<string | null>,
            startPowerSaveBlocker: () => Promise<number>;
            stopPowerSaveBlocker: (powerSaveBlockerID: number) => void;
            deleteSettingsAndRestart: () => void;
            database: {
                getConfig: (key: string) => Promise<string | null>;
                setConfig: (key: string, value: string) => void;
                deleteConfig: (key: string) => void;
                deleteConfigLike: (key: string) => void;
                getErrorReport: (id: number) => Promise<ErrorReport | null>;
                getNewErrorReports: (accountID: number) => Promise<ErrorReport[]>;
                createErrorReport: (accountID: number, accountType: string, errorReportType: string, errorReportData: string, accountUsername: string | null, screenshotDataURI: string | null, sensitiveContextData: string | null) => Promise<void>;
                updateErrorReportSubmitted: (id: number) => void;
                dismissNewErrorReports: (accountID: number) => void;
                getAccount: (accountID: number) => Promise<Account | null>;
                getAccounts: () => Promise<Account[]>;
                createAccount: () => Promise<Account>;
                selectAccountType: (accountID: number, type: string) => Promise<Account>;
                saveAccount: (accountJSON: string) => void;
                deleteAccount: (accountID: number) => void;
            },
            archive: {
                isPageAlreadySaved: (outputPath: string, basename: string) => Promise<boolean>;
                savePage: (webContentsID: number, outputPath: string, basename: string) => Promise<boolean>;
            },
            X: {
                resetProgress: (accountID: number) => Promise<XProgress>;
                createJobs: (accountID: number, jobTypes: string[]) => Promise<XJob[]>;
                getLastFinishedJob: (accountID: number, jobType: string) => Promise<XJob | null>;
                updateJob: (accountID: number, jobJSON: string) => void;
                indexStart: (accountID: number) => void;
                indexStop: (accountID: number) => void;
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
                syncProgress: (accountID: number, progressJSON: string) => void;
                openFolder: (accountID: number, folderName: string) => void;
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
                setConfig: (accountID: number, key: string, value: string) => void;
                deleteConfig: (accountID: number, key: string) => void;
                deleteConfigLike: (accountID: number, key: string) => void;
                blueskyGetProfile: (accountID: number) => Promise<BlueskyMigrationProfile | null>;
                blueskyAuthorize: (accountID: number, handle: string) => Promise<boolean | string>;
                blueskyCallback: (accountID: number, queryString: string) => Promise<boolean | string>;
                blueskyDisconnect: (accountID: number) => Promise<void>;
            };
            onPowerMonitorSuspend: (callback: () => void) => void;
            onPowerMonitorResume: (callback: () => void) => void;
        };
    }
}

const emitter = mitt();
const app = createApp(App);

app.config.globalProperties.emitter = emitter;
app.mount('#app');

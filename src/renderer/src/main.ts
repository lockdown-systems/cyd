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
} from "../../shared_types";
import App from "./App.vue";

declare global {
    interface Window {
        electron: {
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
            showSelectFolderDialog: () => Promise<string | null>;
            openURL: (url: string) => void;
            loadFileInWebview: (webContentsId: number, filename: string) => void;
            getAccountDataPath: (accountID: number, filename: string) => Promise<string | null>,
            startPowerSaveBlocker: () => Promise<number>;
            stopPowerSaveBlocker: (powerSaveBlockerID: number) => void;
            deleteSettingsAndRestart: () => void;
            database: {
                getConfig: (key: string) => Promise<string | null>;
                setConfig: (key: string, value: string) => void;
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
                indexParseLikes: (accountID: number) => Promise<XProgress>;
                indexParseConversations: (accountID: number) => Promise<XProgress>;
                indexIsThereMore: (accountID: number) => Promise<boolean>;
                resetThereIsMore: (accountID: number) => Promise<void>;
                indexMessagesStart: (accountID: number) => Promise<XIndexMessagesStartResponse>;
                indexParseMessages: (accountID: number) => Promise<XProgress>;
                indexTweetsFinished: (accountID: number) => Promise<XProgress>;
                indexConversationsFinished: (accountID: number) => Promise<XProgress>;
                indexMessagesFinished: (accountID: number) => Promise<XProgress>;
                indexConversationFinished: (accountID: number, conversationID: string) => Promise<void>;
                indexLikesFinished: (accountID: number) => Promise<XProgress>;
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
                deleteTweet: (accountID: number, tweetID: string) => Promise<void>;
                deleteDMsMarkAllDeleted: (accountID: number) => Promise<void>;
                deleteDMsScrollToBottom: (accountID: number) => Promise<void>;
                verifyXArchive: (accountID: number, archivePath: string) => Promise<string | null>;
                importXArchive: (accountID: number, archivePath: string, dataType: string) => Promise<XImportArchiveResponse>;
                getCookie: (accountID: number, name: string) => Promise<string | null>;
                getConfig: (accountID: number, key: string) => Promise<string | null>;
                setConfig: (accountID: number, key: string, value: string) => void;
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
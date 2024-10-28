import "bootstrap/dist/css/bootstrap.min.css";
import "bootstrap/dist/js/bootstrap.bundle.min.js";
import "@fortawesome/fontawesome-free/css/all.css";

import mitt from 'mitt';

import { createApp } from "vue";
import type {
    Account,
    XProgress,
    XJob,
    XArchiveStartResponse,
    XIndexMessagesStartResponse,
    XDeleteTweetsStartResponse,
    XRateLimitInfo,
    XProgressInfo,
    ResponseData
} from "../../shared_types";
import App from "./App.vue";

declare global {
    interface Window {
        electron: {
            checkForUpdates: () => void;
            getVersion: () => Promise<string>;
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
            database: {
                getConfig: (key: string) => Promise<string | null>;
                setConfig: (key: string, value: string) => void;
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
                getUsernameStart: (accountID: number) => Promise<boolean>;
                getUsernameStop: (accountID: number) => void;
                getUsername: (accountID: number) => Promise<string | null>;
                indexStart: (accountID: number) => void;
                indexStop: (accountID: number) => void;
                indexParseTweets: (accountID: number, isFirstRun: boolean) => Promise<XProgress>;
                indexParseLikes: (accountID: number, isFirstRun: boolean) => Promise<XProgress>;
                indexParseConversations: (accountID: number, isFirstRun: boolean) => Promise<XProgress>;
                indexIsThereMore: (accountID: number) => Promise<boolean>;
                indexMessagesStart: (accountID: number, isFirstRun: boolean) => Promise<XIndexMessagesStartResponse>;
                indexParseMessages: (accountID: number, isFirstRun: boolean) => Promise<XProgress>;
                indexTweetsFinished: (accountID: number) => Promise<XProgress>;
                indexConversationsFinished: (accountID: number) => Promise<XProgress>;
                indexMessagesFinished: (accountID: number) => Promise<XProgress>;
                indexConversationFinished: (accountID: number, conversationID: string) => Promise<boolean>;
                indexLikesFinished: (accountID: number) => Promise<XProgress>;
                archiveTweetsStart: (accountID: number) => Promise<XArchiveStartResponse>;
                archiveTweetsOutputPath: (accountID: number) => Promise<string>;
                archiveTweet: (accountID: number, tweetID: string) => Promise<boolean>;
                archiveTweetCheckDate: (accountID: number, tweetID: string) => Promise<boolean>;
                archiveBuild: (accountID: number) => Promise<boolean>;
                syncProgress: (accountID: number, progressJSON: string) => void;
                openFolder: (accountID: number, folderName: string) => void;
                resetRateLimitInfo: (accountID: number) => Promise<void>;
                isRateLimited: (accountID: number) => Promise<XRateLimitInfo>;
                getProgress: (accountID: number) => Promise<XProgress>;
                getProgressInfo: (accountID: number) => Promise<XProgressInfo>;
                saveProfileImage: (accountID: number, url: string) => Promise<void>;
                getLatestResponseData: (accountID: number) => Promise<ResponseData | null>;
                deleteTweetsStart: (accountID: number) => Promise<XDeleteTweetsStartResponse>;
                deleteRetweetsStart: (accountID: number) => Promise<XDeleteTweetsStartResponse>;
                deleteLikesStart: (accountID: number) => Promise<XDeleteTweetsStartResponse>;
                deleteTweet: (accountID: number, tweetID: string) => Promise<boolean>;
                deleteDMsStart: (accountID: number) => Promise<XProgress>;
                deleteDMsMarkAllDeleted: (accountID: number) => Promise<void>;
                deleteDMsScrollToBottom: (accountID: number) => Promise<void>;
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
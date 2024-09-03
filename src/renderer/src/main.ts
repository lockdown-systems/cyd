import "bootstrap/dist/css/bootstrap.min.css";
import "bootstrap/dist/js/bootstrap.bundle.min.js";
import "@fortawesome/fontawesome-free/css/all.css";

import { createApp } from "vue";
import type { Account, XProgress, XJob, XArchiveStartResponse, XIndexMessagesStartResponse, XRateLimitInfo, XProgressInfo } from "../../shared_types";
import App from "./App.vue";

declare global {
    interface Window {
        electron: {
            getAPIURL: () => Promise<string>;
            trackEvent: (eventName: string, userAgent: string) => Promise<string>;
            shouldOpenDevtools: () => Promise<boolean>;
            showMessage: (message: string) => void;
            showError: (message: string) => void;
            showQuestion: (message: string, trueText: string, falseText: string) => Promise<boolean>;
            openURL: (url: string) => void;
            loadFileInWebview: (webContentsId: number, filename: string) => void;
            getAccountDataPath: (accountID: number, filename: string) => Promise<string | null>,
            database: {
                getConfig: (key: string) => Promise<string>;
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
                getUsername: (accountID: number, webContentsID: number) => Promise<string | null>;
                indexStart: (accountID: number) => void;
                indexStop: (accountID: number) => void;
                indexParseTweets: (accountID: number, isFirstRun: boolean) => Promise<XProgress>;
                indexParseConversations: (accountID: number, isFirstRun: boolean) => Promise<XProgress>;
                indexIsThereMore: (accountID: number) => Promise<boolean>;
                indexMessagesStart: (accountID: number, isFirstRun: boolean) => Promise<XIndexMessagesStartResponse>;
                indexParseMessages: (accountID: number) => Promise<XProgress>;
                indexTweetsFinished: (accountID: number) => Promise<XProgress>;
                indexConversationsFinished: (accountID: number) => Promise<XProgress>;
                indexMessagesFinished: (accountID: number) => Promise<XProgress>;
                indexConversationFinished: (accountID: number, conversationID: string) => Promise<boolean>;
                indexLikesFinished: (accountID: number) => Promise<XProgress>;
                archiveTweetsStart: (accountID: number) => Promise<XArchiveStartResponse>;
                archiveTweet: (accountID: number, tweetID: string) => Promise<boolean>;
                archiveTweetCheckDate: (accountID: number, tweetID: string) => Promise<boolean>;
                archiveBuild: (accountID: number) => Promise<boolean>;
                syncProgress: (accountID: number, progressJSON: string) => void;
                openFolder: (accountID: number, folderName: string) => void;
                resetRateLimitInfo: (accountID: number) => Promise<void>;
                isRateLimited: (accountID: number) => Promise<XRateLimitInfo>;
                getProgressInfo: (accountID: number) => Promise<XProgressInfo>;
            };
        };
    }
}

createApp(App)
    .mount("#app");

import "bootstrap/dist/css/bootstrap.min.css";
import "bootstrap/dist/js/bootstrap.bundle.min.js";
import "@fortawesome/fontawesome-free/css/all.css";

import { createApp } from "vue";
import type { Account, XProgress, XJob, XTweet } from "../../shared_types";
import App from "./App.vue";

declare global {
    interface Window {
        electron: {
            getApiUrl: () => Promise<string>;
            isDevMode: () => Promise<boolean>;
            showError: (message: string) => void;
            showQuestion: (message: string, trueText: string, falseText: string) => Promise<boolean>;
            openURL: (url: string) => void;
            database: {
                getConfig: (key: string) => Promise<string>;
                setConfig: (key: string, value: string) => void;
                getAccounts: () => Promise<Account[]>;
                createAccount: () => Promise<Account>;
                selectAccountType: (accountID: number, type: string) => Promise<Account>;
                saveAccount: (accountJSON: string) => void;
                deleteAccount: (accountID: number) => void;
            },
            mitmProxy: {
                start: (accountID: number, proxyFilter: string[]) => void;
                stop: (accountID: number) => void;
            },
            archive: {
                isChromiumExtracted: () => Promise<boolean>;
                extractChromium: () => Promise<boolean>;
                saveCookiesFile: (accountID: number) => Promise<void>;
                deleteCookiesFile: (accountID: number) => Promise<void>;
                savePage: (accountID: number, url: string, postDate: Date, postID: string) => Promise<string | null>;
            },
            X: {
                createJobs: (accountID: number, jobTypes: string[]) => Promise<XJob[]>;
                getLastFinishedJob: (accountID: number, jobType: string) => Promise<XJob | null>;
                updateJob: (accountID: number, jobJSON: string) => void;
                indexStart: (accountID: number) => void;
                indexStop: (accountID: number) => void;
                indexParse: (accountID: number, isFirstRun: boolean) => Promise<XProgress>;
                indexFinished: (accountID: number) => Promise<XProgress>;
                archiveGetTweetIDs: (accountID: number) => Promise<string[]>;
                archiveGetTweet: (accountID: number, tweetID: string) => Promise<XTweet | null>;
            };
        };
    }
}

createApp(App)
    .mount("#app");

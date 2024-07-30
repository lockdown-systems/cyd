import "bootstrap/dist/css/bootstrap.min.css";
import "bootstrap/dist/js/bootstrap.bundle.min.js";
import "@fortawesome/fontawesome-free/css/all.css";

import { createApp } from "vue";
import type { Account, XProgress, XJob, XArchiveTweetsStartResponse } from "../../shared_types";
import App from "./App.vue";

declare global {
    interface Window {
        electron: {
            getApiUrl: () => Promise<string>;
            isDevMode: () => Promise<boolean>;
            showError: (message: string) => void;
            showQuestion: (message: string, trueText: string, falseText: string) => Promise<boolean>;
            openURL: (url: string) => void;
            loadFileInWebview: (webContentsId: number, filename: string) => void;
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
                isChromiumExtracted: () => Promise<boolean>;
                extractChromium: () => Promise<boolean>;
                saveCookiesFile: (accountID: number) => Promise<void>;
                deleteCookiesFile: (accountID: number) => Promise<void>;
                singleFile: (accountID: number, outputPath: string, urlsPath: string) => Promise<boolean>;
            },
            X: {
                createJobs: (accountID: number, jobTypes: string[]) => Promise<XJob[]>;
                getLastFinishedJob: (accountID: number, jobType: string) => Promise<XJob | null>;
                updateJob: (accountID: number, jobJSON: string) => void;
                indexStart: (accountID: number) => void;
                indexStop: (accountID: number) => void;
                indexParse: (accountID: number, isFirstRun: boolean) => Promise<XProgress>;
                indexFinished: (accountID: number) => Promise<XProgress>;
                archiveTweetsStart: (accountID: number) => Promise<XArchiveTweetsStartResponse | null>;
                archiveTweetsGetProgress: (accountID: number) => Promise<string[]>;
                archiveTweetsDisplayTweet: (accountID: number, webContentsID: number, filename: string) => void;
                openFolder: (accountID: number, folderName: string) => void;
            };
        };
    }
}

createApp(App)
    .mount("#app");

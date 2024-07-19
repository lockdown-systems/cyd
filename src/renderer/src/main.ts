import "bootstrap/dist/css/bootstrap.min.css";
import "bootstrap/dist/js/bootstrap.bundle.min.js";
import "@fortawesome/fontawesome-free/css/all.css";

import { createApp } from "vue";
import type { Account, XProgress } from "../../shared_types";
import App from "./App.vue";

declare global {
    interface Window {
        electron: {
            getApiUrl: () => Promise<string>;
            isDevMode: () => Promise<boolean>;
            showError: (message: string) => void;
            showQuestion: (message: string, trueText: string, falseText: string) => Promise<boolean>;
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
            X: {
                indexStart: (accountID: number) => void;
                indexStop: (accountID: number) => void;
                indexParse: (accountID: number) => Promise<XProgress>;
            };
        };
    }
}

createApp(App)
    .mount("#app");

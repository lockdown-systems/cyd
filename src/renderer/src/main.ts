import { createApp } from "vue";
import type { Account } from "../../shared_types";

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
            X: {
                fetchStart: (accountID: number) => void;
                fetchStop: (accountID: number) => void;
                fetchParse: (accountID: number) => Promise<boolean>;
            };
        };
    }
}

import "bootstrap/dist/css/bootstrap.min.css";
import "bootstrap/dist/js/bootstrap.bundle.min.js";
import "@fortawesome/fontawesome-free/css/all.css";

import App from "./App.vue";

createApp(App)
    .mount("#app");

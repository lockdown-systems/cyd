import { createApp } from "vue";
import type { Account } from "../../shared_types";

declare global {
    interface Window {
        electron: {
            getApiUrl: () => Promise<string>;
            isDevMode: () => Promise<boolean>;
            getConfig: (key: string) => Promise<string>;
            setConfig: (key: string, value: string) => void;
            getAccounts: () => Promise<Account[]>;
            createAccount: () => Promise<Account>;
            saveAccount: (accountJSON: string) => void;
            showError: (message: string) => void;
        };
    }
}

import "bootstrap/dist/css/bootstrap.min.css";
import "bootstrap/dist/js/bootstrap.bundle.min.js";
import "@fortawesome/fontawesome-free/css/all.css";

import App from "./App.vue";

createApp(App)
    .mount("#app");

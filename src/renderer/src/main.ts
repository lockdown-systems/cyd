import { createApp } from "vue";
import type { XAccount } from "./types";

declare global {
    interface Window {
        electron: {
            getApiUrl: () => Promise<string>;
            isDevMode: () => Promise<boolean>;
            getConfig: (key: string) => Promise<string>;
            setConfig: (key: string, value: string) => void;
            getXAccounts: () => Promise<XAccount[]>;
            createXAccount: () => Promise<XAccount>;
            saveXAccount: (accountJSON: string) => void;
        };
    }
}

import "bootstrap/dist/css/bootstrap.min.css";
import "bootstrap/dist/js/bootstrap.bundle.min.js";
import "@fortawesome/fontawesome-free/css/all.css";

import App from "./App.vue";
import router from './router'

createApp(App)
    .use(router)
    .mount("#app");

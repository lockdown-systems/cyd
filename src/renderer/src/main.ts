import "bootstrap/dist/css/bootstrap.min.css";
import "bootstrap/dist/js/bootstrap.bundle.min.js";
import "@fortawesome/fontawesome-free/css/all.css";
import "./style.css";

import mitt from "mitt";

import { createApp } from "vue";
import type { ElectronAPI } from "../../preload";
import App from "./App.vue";
import i18n from "./i18n";

declare global {
  interface Window {
    electron: ElectronAPI;
  }
}

const emitter = mitt();
const app = createApp(App);

app.config.globalProperties.emitter = emitter;
app.use(i18n);
app.mount("#app");

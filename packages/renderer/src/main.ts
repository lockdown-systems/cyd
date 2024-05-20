import { createApp } from "vue";
import { createMemoryHistory, createRouter } from 'vue-router'

import "bootstrap/dist/css/bootstrap.min.css";
import "bootstrap/dist/js/bootstrap.bundle.min.js";

import App from "./App.vue";
import router from './router'

createApp(App)
    .use(router)
    .mount("#app");

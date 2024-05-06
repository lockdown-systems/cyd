import { createApp } from "vue";
import { createMemoryHistory, createRouter } from 'vue-router'

import "bootstrap/dist/css/bootstrap.min.css";
import "bootstrap/dist/js/bootstrap.bundle.min.js";

import App from "./App.vue";
import Services from "./pages/Services.vue";
import NewService from "./pages/NewService.vue";
import Service from "./pages/Service.vue";
import TestWebview from "./pages/TestWebview.vue";

const routes = [
    { path: '/', component: Services },
    { path: '/new', component: NewService },
    { path: '/service/:id', component: Service },
    { path: '/test-webview', component: TestWebview }
]

const router = createRouter({
    history: createMemoryHistory(),
    routes,
})

createApp(App)
    .use(router)
    .mount("#app");

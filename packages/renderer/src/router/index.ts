import { createRouter, createWebHistory } from "vue-router";
import LoginView from "../views/LoginView.vue";
import Services from "./views/Services.vue";
import NewService from "./views/NewService.vue";
import Service from "./views/Service.vue";
import TestWebview from "./views/TestWebview.vue";

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: "/",
      component: LoginView,
    },
    {
      path: "/services",
      component: () => import("../views/ServicesView.vue"),
    },
    {
      path: "/new",
      component: () => import("../views/NewServiceView.vue"),
    },
    {
      path: "/service/:id",
      component: () => import("../views/ServiceView.vue"),
    },
    {
      path: "/test-webview",
      component: () => import("../views/TestWebview.vue"),
    },
  ],
});

export default router;
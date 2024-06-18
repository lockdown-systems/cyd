import { createRouter, createWebHistory } from "vue-router";
import Login from "../views/LoginView.vue";
import Dashboard from "../views/DashboardView.vue";
import AddService from "../views/AddService.vue";
import AccountX from "../views/AccountX.vue";
import BrowserTest from "../views/BrowserTest.vue";

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: "/",
      component: Login,
    },
    {
      path: "/dashboard",
      component: Dashboard,
    },
    {
      path: "/add-service",
      component: AddService,
    },
    {
      path: "/account/x/:id",
      component: AccountX,
    },
    {
      path: "/browser-test",
      component: BrowserTest,
    },
  ],
});

export default router;
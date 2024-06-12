import { createRouter, createWebHistory } from "vue-router";
import Login from "../views/Login.vue";
import Dashboard from "../views/Dashboard.vue";
import AddService from "../views/AddService.vue";
import AccountX from "../views/AccountX.vue";

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
  ],
});

export default router;
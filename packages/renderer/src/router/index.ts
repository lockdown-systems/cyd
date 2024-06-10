import { createRouter, createWebHistory } from "vue-router";
import LoginView from "../views/LoginView.vue";
import DashboardView from "../views/DashboardView.vue";
import AddServiceView from "../views/AddServiceView.vue";

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: "/",
      component: LoginView,
    },
    {
      path: "/dashboard",
      component: DashboardView,
    },
    {
      path: "/add-service",
      component: AddServiceView,
    }
  ],
});

export default router;
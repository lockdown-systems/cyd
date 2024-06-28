import { createRouter, createMemoryHistory } from "vue-router";
import LoginView from "../views/LoginView.vue";
import TabsView from "../views/TabsView.vue";
import AddServiceView from "../views/AccountView.vue";
import AccountXView from "../views/AccountXView.vue";

const router = createRouter({
  history: createMemoryHistory(),
  routes: [
    {
      path: "/",
      component: LoginView,
    },
    {
      path: "/tabs",
      component: TabsView,
    },
    {
      path: "/add-service",
      component: AddServiceView,
    },
    {
      path: "/account/x/:id",
      component: AccountXView,
    },
  ],
});

export default router;
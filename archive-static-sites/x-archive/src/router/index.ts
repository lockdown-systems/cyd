import { createRouter, createWebHashHistory, RouteRecordRaw } from "vue-router";
import TweetsView from "../views/TweetsView.vue";
import MessagesView from "../views/MessagesView.vue";

const routes: Array<RouteRecordRaw> = [
  {
    path: "/",
    name: "tweets",
    component: TweetsView,
  },
  {
    path: "/messages",
    name: "messages",
    component: MessagesView,
  }
];

const router = createRouter({
  history: createWebHashHistory(),
  routes,
});

export default router;

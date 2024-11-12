import { createRouter, createWebHashHistory, RouteRecordRaw } from "vue-router";
import TweetsView from "../views/TweetsView.vue";
import RetweetsView from "../views/RetweetsView.vue";
import LikesView from "../views/LikesView.vue";
import MessagesView from "../views/MessagesView.vue";

const routes: Array<RouteRecordRaw> = [
  {
    path: "/",
    name: "tweets",
    component: TweetsView,
  },
  {
    path: "/retweets",
    name: "retweets",
    component: RetweetsView,
  },
  {
    path: "/likes",
    name: "likes",
    component: LikesView,
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

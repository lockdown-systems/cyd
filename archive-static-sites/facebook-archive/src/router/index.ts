import { createRouter, createWebHashHistory, RouteRecordRaw } from "vue-router";
import PostsView from "../views/PostsView.vue";

const routes: Array<RouteRecordRaw> = [
  {
    path: "/",
    name: "posts",
    component: PostsView,
  },
];

const router = createRouter({
  history: createWebHashHistory(),
  routes,
});

export default router;

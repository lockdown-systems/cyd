import {
  createRouter,
  createWebHashHistory,
  type RouteRecordRaw,
} from "vue-router";
import StoriesView from "../views/StoriesView.vue";

const routes: Array<RouteRecordRaw> = [
  {
    path: "/",
    name: "posts",
    component: StoriesView,
  },
];

const router = createRouter({
  history: createWebHashHistory(),
  routes,
});

export default router;

import { createRouter, createWebHistory } from "vue-router";
import { useAuthStore } from "../stores/auth";
import { ROUTE_NAMES } from "../constants/routes";
import LoginView from "../components/LoginView.vue";
import DashboardView from "../components/DashboardView.vue";
import OrderHistoryView from "../components/OrderHistoryView.vue";
import ProductManagementView from "../components/ProductManagementView.vue";

const routes = [
  {
    path: "/login",
    name: ROUTE_NAMES.LOGIN,
    component: LoginView,
    meta: { requiresGuest: true },
  },
  {
    path: "/",
    name: ROUTE_NAMES.POS,
    component: DashboardView,
    meta: { requiresAuth: true },
  },
  {
    path: "/orders",
    name: ROUTE_NAMES.ORDERS,
    component: OrderHistoryView,
    meta: { requiresAuth: true },
  },
  {
    path: "/products",
    name: ROUTE_NAMES.PRODUCTS,
    component: ProductManagementView,
    meta: { requiresAuth: true },
  },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

router.beforeEach((to, _from) => {
  const authStore = useAuthStore();

  if (to.meta.requiresAuth && !authStore.isAuthenticated) {
    return { name: ROUTE_NAMES.LOGIN };
  }

  if (to.meta.requiresGuest && authStore.isAuthenticated) {
    return { name: ROUTE_NAMES.POS };
  }
});

export default router;

import { createRouter, createWebHistory } from "vue-router";
import { useAuthStore, USER_ROLES } from "../stores/auth";
import { ROUTE_NAMES } from "../constants/routes";
import LoginView from "../views/LoginView.vue";
import DashboardView from "../views/DashboardView.vue";
import OrderHistoryView from "../views/OrderHistoryView.vue";
import ProductManagementView from "../views/ProductManagementView.vue";
import AnalyticsView from "../views/AnalyticsView.vue";

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
    meta: { requiresAuth: true, requiresRole: USER_ROLES.ADMIN },
  },
  {
    path: "/analytics",
    name: ROUTE_NAMES.ANALYTICS,
    component: AnalyticsView,
    meta: { requiresAuth: true, requiresRole: USER_ROLES.ADMIN },
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

  if (to.meta.requiresRole && authStore.userRole !== to.meta.requiresRole) {
    // Redirect to POS if user doesn't have required role
    return { name: ROUTE_NAMES.POS };
  }
});

export default router;

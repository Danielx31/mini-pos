import { defineStore } from "pinia";
import { ref, computed } from "vue";
import { api, setCsrfToken } from "../lib/api";
import { loadData } from "../lib/loadData";

export const USER_ROLES = Object.freeze({ ADMIN: "admin", MANAGER: "manager", CASHIER: "cashier" });

export const useAuthStore = defineStore("auth", () => {
  const user = ref(null);
  const loginError = ref("");
  const isAuthenticated = computed(() => user.value !== null);
  const displayName = computed(() => user.value?.displayName ?? "");
  const userRole = computed(() => user.value?.role ?? null);
  const isAdmin = computed(() => userRole.value === USER_ROLES.ADMIN);
  const isManager = computed(() => userRole.value === USER_ROLES.MANAGER);
  const canManage = computed(() => isAdmin.value || isManager.value);
  const isCashier = computed(() => userRole.value === USER_ROLES.CASHIER);

  async function restore() {
    try {
      const result = await api("/auth/me");
      user.value = result.user;
      setCsrfToken(result.csrfToken);
      await loadData();
    } catch {
      user.value = null;
      setCsrfToken(null);
    }
  }

  async function login(username, password) {
    loginError.value = "";
    try {
      const result = await api("/auth/login", { method: "POST", body: { username, password } });
      user.value = result.user;
      setCsrfToken(result.csrfToken);
      await loadData();
      return true;
    } catch (error) {
      user.value = null;
      setCsrfToken(null);
      loginError.value = error.message;
      return false;
    }
  }

  async function logout() {
    try { await api("/auth/logout", { method: "POST" }); } catch { /* Clear local session state. */ }
    user.value = null;
    setCsrfToken(null);
    loginError.value = "";
  }

  return { user, loginError, isAuthenticated, displayName, userRole, isAdmin, isManager, canManage, isCashier, restore, login, logout };
});

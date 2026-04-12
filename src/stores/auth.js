import { defineStore } from "pinia";
import { ref, computed } from "vue";

const STORAGE_KEY = "mini_pos_auth";

// User roles
export const USER_ROLES = Object.freeze({
  ADMIN: "admin",
  CASHIER: "cashier",
});

// User database (in production, this would come from a backend)
const USERS = [
  {
    username: "admin",
    password: "admin123",
    role: USER_ROLES.ADMIN,
    displayName: "Administrator",
  },
  {
    username: "cashier",
    password: "cashier123",
    role: USER_ROLES.CASHIER,
    displayName: "Cashier",
  },
];

export const useAuthStore = defineStore("auth", () => {
  const user = ref(loadUserFromStorage());
  const loginError = ref("");

  const isAuthenticated = computed(() => user.value !== null);
  const displayName = computed(() => user.value?.displayName ?? "");
  const userRole = computed(() => user.value?.role ?? null);
  const isAdmin = computed(() => userRole.value === USER_ROLES.ADMIN);
  const isCashier = computed(() => userRole.value === USER_ROLES.CASHIER);

  function loadUserFromStorage() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  }

  function login(username, password) {
    loginError.value = "";

    if (!username || !password) {
      loginError.value = "Username and password are required.";
      return false;
    }

    const foundUser = USERS.find(
      (u) => u.username === username && u.password === password
    );

    if (foundUser) {
      const userData = {
        username: foundUser.username,
        displayName: foundUser.displayName,
        role: foundUser.role,
        loggedInAt: new Date().toISOString(),
      };

      user.value = userData;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(userData));
      return true;
    }

    loginError.value = "Invalid username or password.";
    return false;
  }

  function logout() {
    user.value = null;
    loginError.value = "";
    localStorage.removeItem(STORAGE_KEY);
  }

  return {
    user,
    loginError,
    isAuthenticated,
    displayName,
    userRole,
    isAdmin,
    isCashier,
    login,
    logout,
  };
});

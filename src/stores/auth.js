import { defineStore } from "pinia";
import { ref, computed } from "vue";

const STORAGE_KEY = "mini_pos_auth";
const DEFAULT_USERNAME = "admin";
const DEFAULT_PASSWORD = "admin123";

export const useAuthStore = defineStore("auth", () => {
  const user = ref(loadUserFromStorage());
  const loginError = ref("");

  const isAuthenticated = computed(() => user.value !== null);
  const displayName = computed(() => user.value?.username ?? "");

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

    if (username === DEFAULT_USERNAME && password === DEFAULT_PASSWORD) {
      const userData = { username, loggedInAt: new Date().toISOString() };
      console.log("User Data: ", userData);

      user.value = userData;
      console.log("JSON.stringify(userData): ", JSON.stringify(userData));

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
    login,
    logout,
  };
});

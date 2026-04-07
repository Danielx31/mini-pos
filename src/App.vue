<script setup>
import { useAuthStore } from "./stores/auth";
import LoginView from "./components/LoginView.vue";
import DashboardView from "./components/DashboardView.vue";

const authStore = useAuthStore();
</script>

<template>
  <LoginView v-if="!authStore.isAuthenticated" />
  <DashboardView v-else />
</template>

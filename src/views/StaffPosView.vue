<script setup lang="ts">
import { useAuthStore } from "../stores/auth";
import DashboardView from "./DashboardView.vue";
import LoginView from "./LoginView.vue";

const authStore = useAuthStore();
</script>

<template>
  <DashboardView v-if="authStore.isAuthenticated" />
  <LoginView v-else />
</template>

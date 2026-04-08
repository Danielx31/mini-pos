<script setup>
import { ref } from "vue";
import { useAuthStore } from "./stores/auth";
import LoginView from "./components/LoginView.vue";
import DashboardView from "./components/DashboardView.vue";
import OrderHistoryView from "./components/OrderHistoryView.vue";

const authStore = useAuthStore();
const currentView = ref("pos");

function navigateTo(view) {
  currentView.value = view;
}
</script>

<template>
  <LoginView v-if="!authStore.isAuthenticated" />
  <template v-else>
    <DashboardView v-if="currentView === 'pos'" @navigate="navigateTo" />
    <OrderHistoryView
      v-else-if="currentView === 'orders'"
      @navigate="navigateTo"
    />
  </template>
</template>

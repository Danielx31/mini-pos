<script setup>
import { useRouter } from "vue-router";
import { useAuthStore } from "../stores/auth";
import { ROUTE_NAMES } from "../constants/routes";

const router = useRouter();
const authStore = useAuthStore();

defineProps({
  showBack: {
    type: Boolean,
    default: false,
  },
});

function handleLogout() {
  authStore.logout();
  router.push({ name: ROUTE_NAMES.LOGIN });
}
</script>

<template>
  <header class="sticky top-0 z-30 bg-slate-900/95 border-b border-slate-800/20 shadow-sm backdrop-blur-xl">
    <div class="max-w-7xl mx-auto flex flex-col gap-4 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
      <div class="flex items-center gap-3">
        <div class="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-500 shadow-lg shadow-blue-600/20">
          <svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
          </svg>
        </div>
        <div>
          <h1 class="text-lg font-semibold text-white">Mini POS</h1>
          <p class="text-xs text-slate-400">Fast checkout, inventory, and sales tracking.</p>
        </div>
      </div>

      <div class="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div v-if="!showBack" class="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-2 text-sm text-slate-200">
          <span class="font-medium text-white">Hello,</span>
          <span class="font-semibold text-white">{{ authStore.displayName }}</span>
          <span class="text-xs text-slate-400">({{ authStore.userRole }})</span>
        </div>

        <div class="flex flex-col gap-2 sm:flex-row sm:items-center">
          <button
            v-if="showBack"
            class="inline-flex items-center gap-2 rounded-full border border-slate-700 bg-slate-800 px-3 py-2 text-sm font-medium text-slate-100 hover:border-blue-400 hover:text-blue-100 transition"
            @click="router.push({ name: ROUTE_NAMES.POS })"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to POS
          </button>

          <template v-if="!showBack">
            <button
              v-if="authStore.isAdmin"
              class="inline-flex items-center gap-2 rounded-full border border-slate-700 bg-slate-800 px-3 py-2 text-sm font-medium text-slate-100 hover:border-blue-400 hover:text-blue-100 transition"
              @click="router.push({ name: ROUTE_NAMES.PRODUCTS })"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
              Products
            </button>

            <button
              v-if="authStore.isAdmin"
              class="inline-flex items-center gap-2 rounded-full border border-slate-700 bg-slate-800 px-3 py-2 text-sm font-medium text-slate-100 hover:border-blue-400 hover:text-blue-100 transition"
              @click="router.push({ name: ROUTE_NAMES.ANALYTICS })"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              Analytics
            </button>

            <button
              class="inline-flex items-center gap-2 rounded-full border border-slate-700 bg-slate-800 px-3 py-2 text-sm font-medium text-slate-100 hover:border-blue-400 hover:text-blue-100 transition"
              @click="router.push({ name: ROUTE_NAMES.ORDERS })"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              Orders
            </button>
          </template>

          <button
            class="inline-flex items-center gap-2 rounded-full border border-red-500 bg-slate-900 px-3 py-2 text-sm font-medium text-red-200 hover:border-red-400 hover:text-white transition"
            @click="handleLogout"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            Logout
          </button>
        </div>
      </div>
    </div>
  </header>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useCurrency } from "../composables/useFormatters";
import { useAnalytics } from "../composables/useAnalytics";
import { api } from "../lib/api";
import AppNavbar from "../components/AppNavbar.vue";
import ChartComponent from "../components/ChartComponent.vue";

type ReportOrder = {
  orderNumber: string;
  checkedOutAt: string;
  total: number;
  items: { name: string; quantity: number; price: number; subtotal?: number }[];
  refunded: boolean;
  archived: boolean;
};

const reportOrders = ref<ReportOrder[]>([]);
const isLoading = ref(true);
const reportError = ref("");
let requestInFlight = false;
const { formatCurrency } = useCurrency();
const {
  dailyRevenue,
  weeklyRevenue,
  monthlyRevenue,
  topSellingProducts,
  peakHours,
  analytics,
} = useAnalytics(() => reportOrders.value);

const revenueChartType = ref<"daily" | "weekly" | "monthly">("daily");

const revenueData = computed(() => {
  switch (revenueChartType.value) {
    case "weekly":
      return weeklyRevenue.value;
    case "monthly":
      return monthlyRevenue.value;
    default:
      return dailyRevenue.value;
  }
});

function switchRevenueChartType(type: "daily" | "weekly" | "monthly") {
  revenueChartType.value = type;
}

async function loadReport(): Promise<void> {
  if (requestInFlight) return;
  requestInFlight = true;
  isLoading.value = true;
  reportError.value = "";
  try {
    const result = await api("/reports/orders");
    if (!Array.isArray(result)) throw new Error("The sales report is unavailable right now.");
    reportOrders.value = result as ReportOrder[];
  } catch (error) {
    reportOrders.value = [];
    reportError.value = error instanceof Error ? error.message : "The sales report is unavailable right now.";
  } finally {
    requestInFlight = false;
    isLoading.value = false;
  }
}

onMounted(loadReport);
</script>

<template>
  <div class="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
    <AppNavbar showBack />

    <main class="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
      <!-- Header -->
      <div class="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 class="text-4xl font-bold text-white mb-2">Sales Analytics</h1>
          <p class="text-slate-400">
            Archived sales remain in these reports. Refunded orders are excluded. Card and e-wallet methods have not been verified with a payment provider.
          </p>
        </div>
        <button type="button" :disabled="isLoading" class="rounded-xl border border-slate-500 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:cursor-wait disabled:opacity-50" @click="loadReport">{{ isLoading ? 'Loading…' : 'Refresh report' }}</button>
      </div>

      <p v-if="isLoading" class="rounded-xl border border-slate-700 bg-slate-800 p-6 text-slate-200" role="status">Loading sales report…</p>
      <div v-else-if="reportError" class="rounded-xl border border-rose-500/40 bg-rose-950/40 p-6 text-rose-100" role="alert">
        <p>{{ reportError }}</p>
        <button type="button" class="mt-4 rounded-lg bg-rose-100 px-4 py-2 text-sm font-semibold text-rose-950 hover:bg-white focus:outline-none focus:ring-2 focus:ring-white" @click="loadReport">Try again</button>
      </div>
      <template v-else>

      <!-- Summary Cards -->
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        <!-- Recorded sales total -->
        <div
          class="bg-gradient-to-br from-blue-500/20 to-blue-600/20 border border-blue-500/30 rounded-xl p-6 backdrop-blur"
        >
          <div class="flex items-center justify-between mb-4">
            <h3 class="text-slate-300 font-medium">Recorded Sales Total</h3>
            <svg
              class="w-6 h-6 text-blue-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
          <p class="text-3xl font-bold text-white">
            {{ formatCurrency(analytics.totalRevenue) }}
          </p>
          <p class="text-sm text-slate-400 mt-2">Total from {{ analytics.totalOrders }} recorded orders, including unpaid utang. See Orders for outstanding balances.</p>
        </div>

        <!-- Today's recorded sales -->
        <div
          class="bg-gradient-to-br from-green-500/20 to-green-600/20 border border-green-500/30 rounded-xl p-6 backdrop-blur"
        >
          <div class="flex items-center justify-between mb-4">
            <h3 class="text-slate-300 font-medium">Today's Recorded Sales</h3>
            <svg
              class="w-6 h-6 text-green-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
              />
            </svg>
          </div>
          <p class="text-3xl font-bold text-white">
            {{ formatCurrency(analytics.todayRevenue) }}
          </p>
          <p class="text-sm text-slate-400 mt-2">Today's sales so far</p>
        </div>

        <!-- Average Order Value -->
        <div
          class="bg-gradient-to-br from-purple-500/20 to-purple-600/20 border border-purple-500/30 rounded-xl p-6 backdrop-blur"
        >
          <div class="flex items-center justify-between mb-4">
            <h3 class="text-slate-300 font-medium">Avg Order Value</h3>
            <svg
              class="w-6 h-6 text-purple-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z"
              />
            </svg>
          </div>
          <p class="text-3xl font-bold text-white">
            {{ formatCurrency(analytics.averageOrderValue) }}
          </p>
          <p class="text-sm text-slate-400 mt-2">Average transaction value</p>
        </div>
      </div>

      <!-- Period Summary Cards -->
      <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <!-- This Week -->
        <div
          class="bg-slate-800/50 border border-slate-700/50 rounded-lg p-4 backdrop-blur"
        >
          <h3 class="text-slate-300 font-medium mb-2">This Week</h3>
          <p class="text-2xl font-bold text-white">
            {{ formatCurrency(analytics.thisWeekRevenue) }}
          </p>
        </div>

        <!-- This Month -->
        <div
          class="bg-slate-800/50 border border-slate-700/50 rounded-lg p-4 backdrop-blur"
        >
          <h3 class="text-slate-300 font-medium mb-2">This Month</h3>
          <p class="text-2xl font-bold text-white">
            {{ formatCurrency(analytics.thisMonthRevenue) }}
          </p>
        </div>

        <!-- Total Orders -->
        <div
          class="bg-slate-800/50 border border-slate-700/50 rounded-lg p-4 backdrop-blur"
        >
          <h3 class="text-slate-300 font-medium mb-2">Total Orders</h3>
          <p class="text-2xl font-bold text-white">{{ analytics.totalOrders }}</p>
        </div>
      </div>

      <!-- Recorded sales chart with toggle -->
      <div class="mb-8">
        <div class="flex items-center justify-between mb-4">
          <h2 class="text-2xl font-bold text-white">Recorded Sales Trends</h2>
          <div class="flex gap-2">
            <button
              @click="switchRevenueChartType('daily')"
              :class="[
                'px-4 py-2 rounded-lg font-medium transition',
                revenueChartType === 'daily'
                  ? 'bg-blue-500 text-white'
                  : 'bg-slate-700 text-slate-300 hover:bg-slate-600',
              ]"
            >
              Daily
            </button>
            <button
              @click="switchRevenueChartType('weekly')"
              :class="[
                'px-4 py-2 rounded-lg font-medium transition',
                revenueChartType === 'weekly'
                  ? 'bg-blue-500 text-white'
                  : 'bg-slate-700 text-slate-300 hover:bg-slate-600',
              ]"
            >
              Weekly
            </button>
            <button
              @click="switchRevenueChartType('monthly')"
              :class="[
                'px-4 py-2 rounded-lg font-medium transition',
                revenueChartType === 'monthly'
                  ? 'bg-blue-500 text-white'
                  : 'bg-slate-700 text-slate-300 hover:bg-slate-600',
              ]"
            >
              Monthly
            </button>
          </div>
        </div>

        <ChartComponent
          :data="revenueData"
          type="line"
          title="Recorded Sales Over Time"
          y-axis-label="Recorded sales (₱)"
          label-key="date"
          data-key="revenue"
          :height="400"
        />

        <div v-if="revenueData.length === 0" class="text-center text-slate-400 mt-4">
          No recorded sales data available
        </div>
      </div>

      <!-- Top Selling Products & Peak Hours -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        <!-- Top Selling Products -->
        <div>
          <h2 class="text-2xl font-bold text-white mb-4">Top Selling Products</h2>
          <ChartComponent
            :data="topSellingProducts"
            type="bar"
            title="Products by Quantity Sold"
            y-axis-label="Units Sold"
            label-key="name"
            data-key="quantity"
            :height="350"
          />
          <div v-if="topSellingProducts.length === 0" class="text-center text-slate-400 mt-4">
            No product sales data available
          </div>
        </div>

        <!-- Peak Hours -->
        <div>
          <h2 class="text-2xl font-bold text-white mb-4">Peak Hours</h2>
          <ChartComponent
            :data="peakHours"
            type="bar"
            title="Recorded Sales by Hour of Day"
            y-axis-label="Recorded sales (₱)"
            label-key="hour"
            data-key="revenue"
            :height="350"
          />
        </div>
      </div>

      <!-- Top products by recorded sales -->
      <div v-if="topSellingProducts.length > 0" class="bg-slate-800/50 border border-slate-700/50 rounded-lg p-6 backdrop-blur">
        <h2 class="text-2xl font-bold text-white mb-4">Product Performance</h2>
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead>
              <tr class="border-b border-slate-700">
                <th class="text-left py-3 px-4 text-slate-300 font-semibold">Product</th>
                <th class="text-right py-3 px-4 text-slate-300 font-semibold">Units Sold</th>
                <th class="text-right py-3 px-4 text-slate-300 font-semibold">Recorded Sales</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="(product, index) in topSellingProducts"
                :key="index"
                class="border-b border-slate-700/50 hover:bg-slate-700/30 transition"
              >
                <td class="py-3 px-4 text-slate-100">{{ product.name }}</td>
                <td class="text-right py-3 px-4 text-slate-100">{{ product.quantity }}</td>
                <td class="text-right py-3 px-4 text-slate-100 font-semibold">
                  {{ formatCurrency(product.revenue) }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Empty State -->
      <div v-if="analytics.totalOrders === 0" class="text-center py-16">
        <svg
          class="mx-auto h-12 w-12 text-slate-400 mb-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
          />
        </svg>
        <h3 class="text-xl font-semibold text-slate-200 mb-2">No Sales Data</h3>
        <p class="text-slate-400">
          Complete some sales transactions to see analytics here
        </p>
      </div>
      </template>
    </main>
  </div>
</template>

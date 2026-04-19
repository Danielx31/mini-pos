<script setup>
import { computed, ref } from "vue";
import { useOrdersStore } from "../stores/orders";
import { useCurrency } from "../composables/useFormatters";
import { useAnalytics } from "../composables/useAnalytics";
import AppNavbar from "../components/AppNavbar.vue";
import ChartComponent from "../components/ChartComponent.vue";

const ordersStore = useOrdersStore();
const { formatCurrency } = useCurrency();
const {
  dailyRevenue,
  weeklyRevenue,
  monthlyRevenue,
  topSellingProducts,
  peakHours,
  analytics,
} = useAnalytics(ordersStore.orders);

const revenueChartType = ref("daily"); // 'daily', 'weekly', 'monthly'

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

function switchRevenueChartType(type) {
  revenueChartType.value = type;
}
</script>

<template>
  <div class="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
    <AppNavbar showBack />

    <main class="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
      <!-- Header -->
      <div class="mb-8">
        <h1 class="text-4xl font-bold text-white mb-2">Sales Analytics</h1>
        <p class="text-slate-400">
          Comprehensive insights into your daily, weekly, and monthly sales performance
        </p>
      </div>

      <!-- Summary Cards -->
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        <!-- Total Revenue -->
        <div
          class="bg-gradient-to-br from-blue-500/20 to-blue-600/20 border border-blue-500/30 rounded-xl p-6 backdrop-blur"
        >
          <div class="flex items-center justify-between mb-4">
            <h3 class="text-slate-300 font-medium">Total Revenue</h3>
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
          <p class="text-sm text-slate-400 mt-2">All time revenue from {{ analytics.totalOrders }} orders</p>
        </div>

        <!-- Today's Revenue -->
        <div
          class="bg-gradient-to-br from-green-500/20 to-green-600/20 border border-green-500/30 rounded-xl p-6 backdrop-blur"
        >
          <div class="flex items-center justify-between mb-4">
            <h3 class="text-slate-300 font-medium">Today's Revenue</h3>
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

      <!-- Revenue Chart with Toggle -->
      <div class="mb-8">
        <div class="flex items-center justify-between mb-4">
          <h2 class="text-2xl font-bold text-white">Revenue Trends</h2>
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
          title="Revenue Over Time"
          y-axis-label="Revenue ($)"
          label-key="date"
          data-key="revenue"
          :height="400"
        />

        <div v-if="revenueData.length === 0" class="text-center text-slate-400 mt-4">
          No revenue data available
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
            title="Revenue by Hour of Day"
            y-axis-label="Revenue ($)"
            label-key="hour"
            data-key="revenue"
            :height="350"
          />
        </div>
      </div>

      <!-- Top Products Revenue Table -->
      <div v-if="topSellingProducts.length > 0" class="bg-slate-800/50 border border-slate-700/50 rounded-lg p-6 backdrop-blur">
        <h2 class="text-2xl font-bold text-white mb-4">Product Performance</h2>
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead>
              <tr class="border-b border-slate-700">
                <th class="text-left py-3 px-4 text-slate-300 font-semibold">Product</th>
                <th class="text-right py-3 px-4 text-slate-300 font-semibold">Units Sold</th>
                <th class="text-right py-3 px-4 text-slate-300 font-semibold">Revenue</th>
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
      <div v-if="ordersStore.totalOrders === 0" class="text-center py-16">
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
    </main>
  </div>
</template>

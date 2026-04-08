<script setup>
import { ref } from "vue";
import { useOrdersStore } from "../stores/orders";

const ordersStore = useOrdersStore();
const expandedOrderId = ref(null);

const emit = defineEmits(["navigate"]);

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

function formatCurrency(value) {
  return currencyFormatter.format(value);
}

function formatDateTime(isoString) {
  const date = new Date(isoString);
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function toggleOrderDetail(orderNumber) {
  expandedOrderId.value =
    expandedOrderId.value === orderNumber ? null : orderNumber;
}

function goBackToPOS() {
  emit("navigate", "pos");
}
</script>

<template>
  <div class="min-h-screen bg-slate-50">
    <!-- Top Navbar -->
    <header class="bg-white border-b border-slate-200 shadow-sm">
      <div
        class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-16"
      >
        <div class="flex items-center gap-3">
          <div
            class="flex items-center justify-center w-9 h-9 rounded-lg bg-blue-600"
          >
            <svg
              class="w-5 h-5 text-white"
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
          <h1 class="text-lg font-bold text-slate-800">Mini POS</h1>
        </div>

        <button
          class="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50 hover:text-blue-600 hover:border-blue-200 transition-all"
          @click="goBackToPOS"
        >
          <svg
            class="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M10 19l-7-7m0 0l7-7m-7 7h18"
            />
          </svg>
          Back to POS
        </button>
      </div>
    </header>

    <!-- Main Content -->
    <main class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <!-- Summary Stats -->
      <div class="grid grid-cols-1 gap-4 sm:grid-cols-3 mb-6">
        <div class="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p class="text-sm font-medium text-slate-500">Total Orders</p>
          <p class="mt-1 text-2xl font-bold text-slate-900">
            {{ ordersStore.totalOrders }}
          </p>
        </div>
        <div class="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p class="text-sm font-medium text-slate-500">Total Revenue</p>
          <p class="mt-1 text-2xl font-bold text-emerald-600">
            {{ formatCurrency(ordersStore.totalRevenue) }}
          </p>
        </div>
        <div class="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p class="text-sm font-medium text-slate-500">Items Sold</p>
          <p class="mt-1 text-2xl font-bold text-blue-600">
            {{ ordersStore.totalItemsSold }}
          </p>
        </div>
      </div>

      <!-- Filters & Search -->
      <div
        class="mb-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
      >
        <div
          class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
        >
          <h2 class="text-lg font-semibold text-slate-800">Order History</h2>
          <div class="flex flex-col gap-2 sm:flex-row sm:items-center">
            <input
              v-model="ordersStore.searchTerm"
              type="text"
              placeholder="Search orders or items..."
              class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100 sm:w-56"
            />
            <input
              v-model="ordersStore.dateFilter"
              type="date"
              class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100 sm:w-44"
            />
            <button
              v-if="ordersStore.searchTerm || ordersStore.dateFilter"
              class="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
              @click="ordersStore.clearFilters()"
            >
              Clear
            </button>
          </div>
        </div>
      </div>

      <!-- Orders List -->
      <div class="space-y-3">
        <div
          v-for="order in ordersStore.filteredOrders"
          :key="order.orderNumber"
          class="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden"
        >
          <!-- Order Header (clickable) -->
          <button
            class="w-full flex items-center justify-between gap-4 px-5 py-4 text-left hover:bg-slate-50 transition-colors"
            @click="toggleOrderDetail(order.orderNumber)"
          >
            <div class="flex items-center gap-4 min-w-0">
              <div
                class="flex items-center justify-center w-10 h-10 rounded-lg bg-emerald-50 shrink-0"
              >
                <svg
                  class="w-5 h-5 text-emerald-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
              <div class="min-w-0">
                <p class="text-sm font-semibold text-slate-800 truncate">
                  {{ order.orderNumber }}
                </p>
                <p class="text-xs text-slate-500">
                  {{ formatDateTime(order.checkedOutAt) }}
                  &middot; {{ order.itemCount }}
                  {{ order.itemCount === 1 ? "item" : "items" }}
                </p>
              </div>
            </div>

            <div class="flex items-center gap-3 shrink-0">
              <span class="text-sm font-bold text-slate-900">
                {{ formatCurrency(order.total) }}
              </span>
              <svg
                class="w-5 h-5 text-slate-400 transition-transform duration-200"
                :class="{ 'rotate-180': expandedOrderId === order.orderNumber }"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            </div>
          </button>

          <!-- Expanded Order Details -->
          <div
            v-if="expandedOrderId === order.orderNumber"
            class="border-t border-slate-200 px-5 py-4 bg-slate-50"
          >
            <!-- Items Table -->
            <table class="w-full text-sm">
              <thead>
                <tr
                  class="text-left text-xs font-medium uppercase tracking-wide text-slate-500"
                >
                  <th class="pb-2">Item</th>
                  <th class="pb-2 text-center">Qty</th>
                  <th class="pb-2 text-right">Price</th>
                  <th class="pb-2 text-right">Total</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-200">
                <tr v-for="item in order.items" :key="item.productId">
                  <td class="py-2 text-slate-700">{{ item.name }}</td>
                  <td class="py-2 text-center text-slate-600">
                    {{ item.quantity }}
                  </td>
                  <td class="py-2 text-right text-slate-600">
                    {{ formatCurrency(item.price) }}
                  </td>
                  <td class="py-2 text-right font-medium text-slate-800">
                    {{ formatCurrency(item.quantity * item.price) }}
                  </td>
                </tr>
              </tbody>
            </table>

            <!-- Financial Summary -->
            <div class="mt-3 border-t border-slate-200 pt-3 space-y-1 text-sm">
              <div class="flex justify-between text-slate-600">
                <span>Subtotal</span>
                <span>{{ formatCurrency(order.subtotal) }}</span>
              </div>
              <div class="flex justify-between text-slate-600">
                <span>Tax (8%)</span>
                <span>{{ formatCurrency(order.tax) }}</span>
              </div>
              <div
                class="flex justify-between font-semibold text-slate-900 pt-1"
              >
                <span>Total</span>
                <span>{{ formatCurrency(order.total) }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Empty State -->
        <div
          v-if="ordersStore.filteredOrders.length === 0"
          class="rounded-xl border border-dashed border-slate-300 bg-white py-12 text-center"
        >
          <svg
            class="mx-auto w-12 h-12 text-slate-300"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="1.5"
              d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
            />
          </svg>
          <p class="mt-3 text-sm font-medium text-slate-500">
            {{
              ordersStore.searchTerm || ordersStore.dateFilter
                ? "No orders match your filters."
                : "No orders yet. Complete a sale to see it here."
            }}
          </p>
        </div>
      </div>

      <!-- Clear History Button -->
      <div v-if="ordersStore.orders.length > 0" class="mt-6 flex justify-end">
        <button
          class="rounded-lg border border-rose-200 bg-white px-4 py-2 text-sm font-medium text-rose-600 hover:bg-rose-50 transition-colors"
          @click="ordersStore.clearHistory()"
        >
          Clear All History
        </button>
      </div>
    </main>
  </div>
</template>

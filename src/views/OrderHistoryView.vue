<script setup>
import { ref } from "vue";
import { useOrdersStore } from "../stores/orders";
import { useCurrency, useDateTime } from "../composables/useFormatters";
import { useReceiptPdf } from "../composables/useReceiptPdf";
import AppNavbar from "../components/AppNavbar.vue";
import ReceiptView from "../components/ReceiptView.vue";

const ordersStore = useOrdersStore();
const { formatCurrency } = useCurrency();
const { formatDateTime } = useDateTime();
const { generatePDF, printReceipt } = useReceiptPdf();

const expandedOrderId = ref(null);
const selectedOrderForReceipt = ref(null);
const isReceiptModalOpen = ref(false);
const isPdfGenerating = ref(false);

function toggleOrderDetail(orderNumber) {
  expandedOrderId.value = expandedOrderId.value === orderNumber ? null : orderNumber;
}

function openReceiptModal(order) {
  selectedOrderForReceipt.value = order;
  isReceiptModalOpen.value = true;
}

function closeReceiptModal() {
  isReceiptModalOpen.value = false;
  selectedOrderForReceipt.value = null;
}

async function handleDownloadPDF() {
  if (!selectedOrderForReceipt.value) return;
  try {
    isPdfGenerating.value = true;
    await generatePDF(selectedOrderForReceipt.value.orderNumber);
  } catch (error) {
    alert("Failed to generate PDF. Please try again.");
  } finally {
    isPdfGenerating.value = false;
  }
}

function handlePrint() {
  if (!selectedOrderForReceipt.value) return;
  printReceipt(selectedOrderForReceipt.value.orderNumber);
}

function confirmClearHistory() {
  const confirmed = window.confirm("Are you sure you want to delete all order history? This cannot be undone.");
  if (!confirmed) return;
  ordersStore.clearHistory();
}
</script>

<template>
  <div class="min-h-screen bg-slate-50">
    <AppNavbar show-back />

    <main class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div class="grid grid-cols-1 gap-4 sm:grid-cols-3 mb-6">
        <div class="rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm">
          <p class="text-sm font-medium text-slate-500">Total Orders</p>
          <p class="mt-1 text-2xl font-bold text-slate-900">{{ ordersStore.totalOrders }}</p>
        </div>
        <div class="rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm">
          <p class="text-sm font-medium text-slate-500">Total Revenue</p>
          <p class="mt-1 text-2xl font-bold text-emerald-600">{{ formatCurrency(ordersStore.totalRevenue) }}</p>
        </div>
        <div class="rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm">
          <p class="text-sm font-medium text-slate-500">Items Sold</p>
          <p class="mt-1 text-2xl font-bold text-blue-600">{{ ordersStore.totalItemsSold }}</p>
        </div>
      </div>

      <div class="mb-6 rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm">
        <div class="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 class="text-lg font-semibold text-slate-800">Order History</h2>
            <p class="mt-1 text-sm text-slate-500">Search past sales, filter by date, and inspect checkout details.</p>
          </div>
          <div class="grid w-full gap-3 sm:grid-cols-3 lg:w-auto lg:grid-cols-[220px_160px_auto]">
            <div class="relative">
              <svg class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-4.35-4.35M11 19a8 8 0 100-16 8 8 0 000 16z" />
              </svg>
              <input v-model="ordersStore.searchTerm" type="text" placeholder="Search orders or items..." class="w-full rounded-2xl border border-slate-300 bg-white px-10 py-3 text-sm text-slate-700 placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100" />
            </div>
            <input v-model="ordersStore.dateFilter" type="date" class="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-700 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100" />
            <button v-if="ordersStore.searchTerm || ordersStore.dateFilter" class="rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-medium text-slate-600 hover:bg-slate-50 transition" @click="ordersStore.clearFilters()">Clear</button>
          </div>
        </div>
      </div>

      <div class="space-y-4">
        <div v-for="order in ordersStore.filteredOrders" :key="order.orderNumber" class="overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white shadow-sm">
          <button class="w-full flex flex-col gap-4 px-5 py-4 text-left hover:bg-slate-50 transition-colors sm:flex-row sm:items-center sm:justify-between" @click="toggleOrderDetail(order.orderNumber)">
            <div class="flex items-center gap-4 min-w-0">
              <div class="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div class="min-w-0">
                <p class="truncate text-sm font-semibold text-slate-800">{{ order.orderNumber }}</p>
                <p class="mt-1 text-xs text-slate-500">{{ formatDateTime(order.checkedOutAt) }} · {{ order.itemCount }} {{ order.itemCount === 1 ? 'item' : 'items' }}</p>
              </div>
            </div>
            <div class="flex items-center gap-3 text-slate-900">
              <span class="text-sm font-semibold">{{ formatCurrency(order.total) }}</span>
              <svg class="w-5 h-5 text-slate-400 transition-transform duration-200" :class="{ 'rotate-180': expandedOrderId === order.orderNumber }" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </button>

          <div v-if="expandedOrderId === order.orderNumber" class="border-t border-slate-200 bg-slate-50 px-5 py-4">
            <table class="w-full text-sm">
              <thead>
                <tr class="text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                  <th class="pb-2">Item</th>
                  <th class="pb-2 text-center">Qty</th>
                  <th class="pb-2 text-right">Price</th>
                  <th class="pb-2 text-right">Total</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-200">
                <tr v-for="item in order.items" :key="item.productId">
                  <td class="py-2 text-slate-700">{{ item.name }}</td>
                  <td class="py-2 text-center text-slate-600">{{ item.quantity }}</td>
                  <td class="py-2 text-right text-slate-600">{{ formatCurrency(item.price) }}</td>
                  <td class="py-2 text-right font-medium text-slate-800">{{ formatCurrency(item.quantity * item.price) }}</td>
                </tr>
              </tbody>
            </table>

            <div class="mt-4 border-t border-slate-200 pt-4 text-sm">
              <div class="flex justify-between text-slate-600"><span>Subtotal</span><span>{{ formatCurrency(order.subtotal) }}</span></div>
              <div v-if="order.coupon" class="mt-2 flex justify-between text-emerald-600"><span>Discount ({{ order.coupon.code }})</span><span>-{{ formatCurrency(order.discount) }}</span></div>
              <div class="mt-2 flex justify-between text-slate-600"><span>Tax (8%)</span><span>{{ formatCurrency(order.tax) }}</span></div>
              <div class="mt-3 flex justify-between text-base font-semibold text-slate-900"><span>Total</span><span>{{ formatCurrency(order.total) }}</span></div>
            </div>

            <!-- Payment Information -->
            <div v-if="order.payment" class="mt-4 border-t border-slate-200 pt-4">
              <div class="flex items-center justify-between">
                <p class="text-xs font-semibold uppercase tracking-wide text-slate-500">Payment Method</p>
                <span
                  class="inline-flex rounded-full px-3 py-1 text-xs font-semibold"
                  :class="{
                    'bg-blue-100 text-blue-700': order.payment.paymentMethod === 'card',
                    'bg-green-100 text-green-700': order.payment.paymentMethod === 'cash',
                    'bg-purple-100 text-purple-700': order.payment.paymentMethod === 'e-wallet',
                  }"
                >
                  {{
                    order.payment.paymentMethod === 'card'
                      ? 'Credit/Debit Card'
                      : order.payment.paymentMethod === 'cash'
                        ? 'Cash'
                        : 'E-Wallet'
                  }}
                </span>
              </div>

              <!-- Cash Payment Details -->
              <div
                v-if="order.payment.paymentMethod === 'cash'"
                class="mt-3 space-y-2 rounded-xl bg-green-50 p-3"
              >
                <div class="flex justify-between text-sm text-green-900">
                  <span>Cash Tendered</span>
                  <span class="font-semibold">{{
                    formatCurrency(order.payment.cashTendered)
                  }}</span>
                </div>
                <div class="flex justify-between text-sm text-green-900">
                  <span>Change</span>
                  <span class="font-semibold">{{
                    formatCurrency(order.payment.change)
                  }}</span>
                </div>
              </div>
            </div>

            <!-- Receipt Actions -->
            <div class="mt-4 border-t border-slate-200 pt-4 flex gap-2 justify-end">
              <button
                @click="openReceiptModal(order)"
                class="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition"
              >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                View Receipt
              </button>
              <button
                @click="() => { openReceiptModal(order); $nextTick(() => handlePrint()); }"
                class="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition"
              >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                </svg>
                Print
              </button>
              <button
                @click="() => { selectedOrderForReceipt = order; handleDownloadPDF(); }"
                class="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                :disabled="isPdfGenerating"
              >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                {{ isPdfGenerating ? 'Generating...' : 'Download PDF' }}
              </button>
            </div>
          </div>
        </div>

        <div v-if="ordersStore.filteredOrders.length === 0" class="rounded-[1.75rem] border border-dashed border-slate-300 bg-white py-12 text-center shadow-sm">
          <svg class="mx-auto h-12 w-12 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
          <p class="mt-3 text-sm font-medium text-slate-500">{{ ordersStore.searchTerm || ordersStore.dateFilter ? 'No orders match your filters.' : 'No orders yet. Complete a sale to see it here.' }}</p>
        </div>
      </div>

      <div v-if="ordersStore.orders.length > 0" class="mt-6 flex justify-end">
        <button class="rounded-2xl border border-rose-200 bg-white px-4 py-3 text-sm font-medium text-rose-600 hover:bg-rose-50 transition" @click="confirmClearHistory">Clear All History</button>
      </div>
    </main>

    <!-- Receipt Modal -->
    <div v-if="isReceiptModalOpen" class="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
      <div class="relative w-full max-w-2xl max-h-[90vh] bg-white rounded-2xl shadow-2xl overflow-auto">
        <!-- Modal Header -->
        <div class="sticky top-0 flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4">
          <h2 class="text-lg font-semibold text-slate-900">Receipt - {{ selectedOrderForReceipt?.orderNumber }}</h2>
          <button
            @click="closeReceiptModal"
            class="rounded-lg bg-slate-100 p-1 text-slate-600 hover:bg-slate-200 transition"
          >
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <!-- Modal Body - Receipt Content -->
        <div class="overflow-auto p-6">
          <div class="flex justify-center">
            <ReceiptView v-if="selectedOrderForReceipt" :order="selectedOrderForReceipt" />
          </div>
        </div>

        <!-- Modal Footer -->
        <div class="sticky bottom-0 border-t border-slate-200 bg-white px-6 py-4 flex gap-3 justify-end">
          <button
            @click="closeReceiptModal"
            class="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition"
          >
            Close
          </button>
          <button
            @click="handlePrint"
            class="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition inline-flex items-center gap-2"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
            </svg>
            Print
          </button>
          <button
            @click="handleDownloadPDF"
            class="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 transition inline-flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            :disabled="isPdfGenerating"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            {{ isPdfGenerating ? 'Generating...' : 'Download PDF' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

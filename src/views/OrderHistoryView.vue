<script setup>
import { ref } from "vue";
import { useOrdersStore } from "../stores/orders";
import { useAuthStore } from "../stores/auth";
import { useCurrency, useDateTime } from "../composables/useFormatters";
import { useReceiptPdf } from "../composables/useReceiptPdf";
import AppNavbar from "../components/AppNavbar.vue";
import ReceiptView from "../components/ReceiptView.vue";
import { lineTotal } from "../../shared/money.js";

const ordersStore = useOrdersStore();
const authStore = useAuthStore();
const { formatCurrency } = useCurrency();
const { formatDateTime } = useDateTime();
const { generatePDF, printReceipt } = useReceiptPdf();

function getTaxLabel(order) {
  return order.taxRateSummary || "8%";
}

const expandedOrderId = ref(null);
const selectedOrderForReceipt = ref(null);
const isReceiptModalOpen = ref(false);
const isPdfGenerating = ref(false);
const creditPayments = ref([]);
const creditNotice = ref(null);
const repaymentAmount = ref("");
const repaymentNote = ref("");
const repaymentKey = ref(crypto.randomUUID());
const isRecordingRepayment = ref(false);

async function toggleOrderDetail(order) {
  expandedOrderId.value = expandedOrderId.value === order.orderNumber ? null : order.orderNumber;
  creditPayments.value = [];
  creditNotice.value = null;
  repaymentAmount.value = "";
  repaymentNote.value = "";
  repaymentKey.value = crypto.randomUUID();
  if (expandedOrderId.value && order.credit) {
    try {
      const payments = await ordersStore.loadCreditPayments(order.orderNumber);
      if (expandedOrderId.value === order.orderNumber) creditPayments.value = payments;
    } catch (error) {
      if (expandedOrderId.value === order.orderNumber) creditNotice.value = { ok: false, message: error.message };
    }
  }
}

async function recordRepayment(order) {
  if (isRecordingRepayment.value) return;
  isRecordingRepayment.value = true;
  try {
    const result = await ordersStore.recordCreditPayment(order.orderNumber, {
      paymentKey: repaymentKey.value,
      amount: repaymentAmount.value,
      method: "cash",
      note: repaymentNote.value,
    });
    creditNotice.value = result;
    if (result.ok) {
      creditPayments.value = result.payments;
      repaymentAmount.value = "";
      repaymentNote.value = "";
      repaymentKey.value = crypto.randomUUID();
    }
  } finally {
    isRecordingRepayment.value = false;
  }
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
  } catch {
    alert("Failed to generate PDF. Please try again.");
  } finally {
    isPdfGenerating.value = false;
  }
}

function handlePrint() {
  if (!selectedOrderForReceipt.value) return;
  printReceipt(selectedOrderForReceipt.value.orderNumber);
}

async function confirmClearHistory() {
  const confirmed = window.confirm("Archive all visible order history? Records remain stored on the server for managers and administrators.");
  if (!confirmed) return;
  const result = await ordersStore.clearHistory();
  if (!result.ok) alert(result.message);
}

async function confirmRefund(order) {
  if (!authStore.canManage || order.refunded) return;
  const creditMessage = order.credit ? " Any cash repayments already collected must be returned separately." : "";
  const confirmed = window.confirm(`Record a refund for order ${order.orderNumber} and restore inventory? Mini POS does not return funds. Handle any external refund separately.${creditMessage} This cannot be undone.`);
  if (!confirmed) return;
  const result = await ordersStore.refundOrder(order.orderNumber);
  if (result.ok) {
    alert(result.message);
  } else {
    alert(`Refund failed: ${result.message}`);
  }
}
</script>

<template>
  <div class="min-h-screen bg-slate-50">
    <AppNavbar show-back />

    <main class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6">
        <div class="rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm">
          <p class="text-sm font-medium text-slate-500">Total Orders</p>
          <p class="mt-1 text-2xl font-bold text-slate-900">{{ ordersStore.totalOrders }}</p>
        </div>
        <div class="rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm">
          <p class="text-sm font-medium text-slate-500">Recorded Sales (includes utang)</p>
          <p class="mt-1 text-2xl font-bold text-emerald-600">{{ formatCurrency(ordersStore.totalRevenue) }}</p>
        </div>
        <div class="rounded-[1.75rem] border border-amber-200 bg-amber-50 p-5 shadow-sm">
          <p class="text-sm font-medium text-amber-800">Outstanding POS Utang</p>
          <p class="mt-1 text-2xl font-bold text-amber-950">{{ formatCurrency(ordersStore.outstandingCredit) }}</p>
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
              <input v-model="ordersStore.searchTerm" type="text" placeholder="Search order, item, or customer..." class="w-full rounded-2xl border border-slate-300 bg-white px-10 py-3 text-sm text-slate-700 placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100" />
            </div>
            <input v-model="ordersStore.dateFilter" type="date" class="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-700 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100" />
            <button v-if="ordersStore.searchTerm || ordersStore.dateFilter" class="rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-medium text-slate-600 hover:bg-slate-50 transition" @click="ordersStore.clearFilters()">Clear</button>
          </div>
        </div>
      </div>

      <div class="space-y-4">
        <div v-for="order in ordersStore.filteredOrders" :key="order.orderNumber" class="overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white shadow-sm">
          <button class="w-full flex flex-col gap-4 px-5 py-4 text-left hover:bg-slate-50 transition-colors sm:flex-row sm:items-center sm:justify-between" @click="toggleOrderDetail(order)">
            <div class="flex items-center gap-4 min-w-0">
              <div class="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div class="min-w-0">
                <div class="flex flex-wrap items-center gap-2">
                  <p class="truncate text-sm font-semibold text-slate-800">{{ order.orderNumber }}</p>
                  <span v-if="order.credit && !order.refunded" class="inline-flex rounded-full bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-900">{{ order.credit.balance > 0 ? `Utang · ${formatCurrency(order.credit.balance)} due` : 'Utang paid' }}</span>
                  <span v-else-if="order.payment && order.payment.paymentMethod !== 'cash' && !order.refunded" class="inline-flex rounded-full bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-800">Payment unverified</span>
                  <span v-if="order.refunded" class="inline-flex rounded-full px-2 py-1 text-xs font-semibold bg-rose-100 text-rose-700">
                    Refund recorded
                  </span>
                </div>
                <p class="mt-1 text-xs text-slate-500">{{ formatDateTime(order.checkedOutAt) }} · {{ order.itemCount }} {{ order.itemCount === 1 ? 'item' : 'items' }}</p>
                <p v-if="order.refunded" class="mt-1 text-xs text-rose-600">Refund recorded on {{ formatDateTime(order.refundedAt) }}</p>
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
                  <td class="py-2 text-right font-medium text-slate-800">{{ formatCurrency(lineTotal(item.price, item.quantity)) }}</td>
                </tr>
              </tbody>
            </table>

            <div class="mt-4 border-t border-slate-200 pt-4 text-sm">
              <div class="flex justify-between text-slate-600"><span>Subtotal</span><span>{{ formatCurrency(order.subtotal) }}</span></div>
              <div v-if="order.coupon" class="mt-2 flex justify-between text-emerald-600"><span>Discount ({{ order.coupon.code }})</span><span>-{{ formatCurrency(order.discount) }}</span></div>
              <div class="mt-2 flex justify-between text-slate-600"><span>Tax ({{ getTaxLabel(order) }})</span><span>{{ formatCurrency(order.tax) }}</span></div>
              <div class="mt-3 flex justify-between text-base font-semibold text-slate-900"><span>Total</span><span>{{ formatCurrency(order.total) }}</span></div>
            </div>

            <!-- Payment Information -->
            <div v-if="order.payment" class="mt-4 border-t border-slate-200 pt-4">
              <div class="flex items-center justify-between">
                <p class="text-xs font-semibold uppercase tracking-wide text-slate-500">Method Recorded</p>
                <span
                  class="inline-flex rounded-full px-3 py-1 text-xs font-semibold"
                  :class="{
                    'bg-blue-100 text-blue-700': order.payment.paymentMethod === 'card',
                    'bg-green-100 text-green-700': order.payment.paymentMethod === 'cash',
                    'bg-purple-100 text-purple-700': order.payment.paymentMethod === 'e-wallet',
                    'bg-amber-100 text-amber-800': order.payment.paymentMethod === 'credit',
                  }"
                >
                  {{
                    order.payment.paymentMethod === 'card'
                      ? 'Credit/Debit Card'
                      : order.payment.paymentMethod === 'cash'
                        ? 'Cash'
                        : order.payment.paymentMethod === 'credit' ? 'Utang / Pay later' : 'E-Wallet'
                  }}
                </span>
              </div>

              <p v-if="order.payment.paymentMethod === 'credit'" class="mt-2 text-xs text-amber-800">{{ order.refunded ? 'Sale refunded; remaining debt cancelled.' : order.credit?.balance > 0 ? 'Payment status: Utang balance outstanding.' : 'Payment status: Fully repaid in recorded cash.' }}</p>
              <p v-else-if="order.payment.paymentMethod !== 'cash'" class="mt-2 text-xs text-amber-800">Payment status: Not verified by Mini POS. No card or wallet charge was made by this app.</p>
              <p v-else class="mt-2 text-xs text-slate-600">Payment status: Cash amount entered by staff.</p>

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

            <section v-if="order.credit" class="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4">
              <div class="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 class="font-semibold text-amber-950">Utang for {{ order.credit.customerName }}</h3>
                  <p v-if="order.credit.customerContact" class="text-sm text-amber-900">Contact: {{ order.credit.customerContact }}</p>
                  <p v-if="order.credit.dueDate" class="text-sm text-amber-900">Due: {{ order.credit.dueDate }}</p>
                </div>
                <div class="text-right">
                  <p class="text-xs text-amber-800">Outstanding balance</p>
                  <p class="text-xl font-bold text-amber-950">{{ formatCurrency(order.credit.balance) }}</p>
                </div>
              </div>
              <p v-if="order.refunded" class="mt-3 text-sm text-rose-800">Sale refunded. Any collected repayments must be returned outside Mini POS.</p>
              <form v-else-if="order.credit.balance > 0" class="mt-4 grid gap-3 border-t border-amber-200 pt-4 sm:grid-cols-[1fr_1fr_auto]" @submit.prevent="recordRepayment(order)">
                <div>
                  <label for="repayment-amount" class="block text-xs font-semibold text-amber-950">Cash received</label>
                  <input id="repayment-amount" v-model="repaymentAmount" type="number" min="0.01" step="0.01" :max="order.credit.balance" required class="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-100" placeholder="Amount" />
                </div>
                <div>
                  <label for="repayment-note" class="block text-xs font-semibold text-amber-950">Note (optional)</label>
                  <input id="repayment-note" v-model="repaymentNote" type="text" maxlength="200" class="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-100" placeholder="Reference or note" />
                </div>
                <button type="submit" :disabled="isRecordingRepayment" class="self-end rounded-xl bg-amber-700 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-600 disabled:opacity-50">{{ isRecordingRepayment ? 'Recording...' : 'Record cash' }}</button>
              </form>
              <p v-if="creditNotice" role="status" aria-live="polite" class="mt-3 rounded-xl border p-3 text-sm" :class="creditNotice.ok ? 'border-emerald-200 bg-emerald-50 text-emerald-900' : 'border-rose-200 bg-rose-50 text-rose-800'">{{ creditNotice.message }}</p>
              <div v-if="creditPayments.length" class="mt-4 border-t border-amber-200 pt-3">
                <h4 class="text-xs font-semibold uppercase tracking-wide text-amber-900">Cash repayments</h4>
                <ul class="mt-2 space-y-2">
                  <li v-for="payment in creditPayments" :key="payment.id" class="flex flex-wrap justify-between gap-2 rounded-xl bg-white px-3 py-2 text-sm text-slate-700">
                    <span>{{ formatDateTime(payment.receivedAt) }} · {{ payment.receivedBy }}<span v-if="payment.note"> · {{ payment.note }}</span></span>
                    <strong>{{ formatCurrency(payment.amount) }}</strong>
                  </li>
                </ul>
              </div>
            </section>

            <!-- Receipt Actions -->
            <div class="mt-4 border-t border-slate-200 pt-4 flex gap-2 justify-end">
              <button
                v-if="authStore.canManage && !order.refunded"
                @click="confirmRefund(order)"
                class="inline-flex items-center gap-2 rounded-lg border border-rose-300 bg-white px-4 py-2 text-sm font-medium text-rose-700 hover:bg-rose-50 transition"
              >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                </svg>
                Record Refund
              </button>
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
        <button v-if="authStore.canManage" class="rounded-2xl border border-rose-200 bg-white px-4 py-3 text-sm font-medium text-rose-600 hover:bg-rose-50 transition" @click="confirmClearHistory">Archive History</button>
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

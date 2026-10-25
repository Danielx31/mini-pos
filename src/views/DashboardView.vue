<script setup>
import { defineAsyncComponent, onMounted, onUnmounted, ref, watch } from "vue";
import { usePosStore } from "../stores/pos";
import { useCouponsStore } from "../stores/coupons";
import { usePaymentStore } from "../stores/payment";
import { useCurrency, useDateTime } from "../composables/useFormatters";
import { useReceiptPdf } from "../composables/useReceiptPdf";
import { lineTotal } from "../../shared/money.js";
import AppNavbar from "../components/AppNavbar.vue";
import PaymentModal from "../components/PaymentModal.vue";
import ReceiptView from "../components/ReceiptView.vue";

const PhoneBarcodeScanner = defineAsyncComponent(() => import("../components/PhoneBarcodeScanner.vue"));

const posStore = usePosStore();
const couponsStore = useCouponsStore();
const paymentStore = usePaymentStore();
const { formatCurrency } = useCurrency();
const { formatDateTime } = useDateTime();
const { generatePDF, printReceipt } = useReceiptPdf();
const checkoutNotice = ref(null);
const barcodeInput = ref("");
const barcodeInputElement = ref(null);
const barcodeNotice = ref(null);
const showPhoneScanner = ref(false);
const BARCODE_IDLE_MS = 450;
let barcodeTimer = null;
const parkedCustomerLabel = ref("");
const parkedOrderNote = ref("");

const isReceiptModalOpen = ref(false);
const selectedOrder = ref(null);
const isPdfGenerating = ref(false);

function addProductToCart(product) {
  const result = posStore.addToCart(product);
  if (!result.ok) {
    checkoutNotice.value = result;
  } else {
    checkoutNotice.value = null;
  }
}

function handleBarcodeSubmit() {
  clearTimeout(barcodeTimer);
  if (!barcodeInput.value.trim()) return;
  const result = posStore.addToCartByBarcode(barcodeInput.value);
  barcodeInput.value = "";
  barcodeNotice.value = result;
  if (result.ok) {
    checkoutNotice.value = null;
    showPhoneScanner.value = false;
  }
  barcodeInputElement.value?.focus({ preventScroll: true });
}

function handleCameraDetected(code) {
  const result = posStore.addToCartByBarcode(code);
  barcodeNotice.value = result;
  if (result.ok) {
    checkoutNotice.value = null;
    showPhoneScanner.value = false;
  }
}

watch(barcodeInput, (code) => {
  clearTimeout(barcodeTimer);
  if (!code.trim()) return;
  barcodeNotice.value = null;

  barcodeTimer = setTimeout(() => {
    const normalized = code.trim().toLowerCase();
    const productCodes = posStore.products.flatMap((product) =>
      [product.id, product.sku].filter(Boolean).map((value) => value.toLowerCase()),
    );
    const exactMatch = productCodes.includes(normalized);
    const couldBeLongerCode = productCodes.some((value) => value.length > normalized.length && value.startsWith(normalized));
    if (exactMatch && !couldBeLongerCode && barcodeInput.value.trim() === code.trim()) handleBarcodeSubmit();
  }, BARCODE_IDLE_MS);
});
watch(() => posStore.isHoldPending, (pending) => {
  if (pending) showPhoneScanner.value = false;
});

onMounted(() => {
  if (window.matchMedia("(pointer: fine)").matches) barcodeInputElement.value?.focus({ preventScroll: true });
});
onUnmounted(() => clearTimeout(barcodeTimer));

function decreaseQuantity(item) {
  posStore.updateQuantity(item.productId, item.quantity - 1);
}

function increaseQuantity(item) {
  const result = posStore.updateQuantity(item.productId, item.quantity + 1);
  if (result?.ok === false) {
    checkoutNotice.value = result;
  } else {
    checkoutNotice.value = null;
  }
}

async function checkoutSale() {
  showPhoneScanner.value = false;
  const result = await posStore.initiateCheckout();
  
  if (!result.ok) {
    checkoutNotice.value = result;
    return;
  }
  
  checkoutNotice.value = null;
  paymentStore.openPaymentModal();
}

async function holdCurrentOrder() {
  const result = await posStore.parkCurrentOrder({
    customerLabel: parkedCustomerLabel.value,
    note: parkedOrderNote.value,
  });

  if (result.ok) {
    parkedCustomerLabel.value = "";
    parkedOrderNote.value = "";
  }

  checkoutNotice.value = result;
}

async function recallParkedOrder(holdNumber) {
  const result = await posStore.recallParkedOrder(holdNumber);
  checkoutNotice.value = result;
}

async function removeParkedOrder(holdNumber) {
  const confirmed = window.confirm(
    `Remove parked order ${holdNumber}? This action cannot be undone.`,
  );

  if (!confirmed) {
    return;
  }

  const result = await posStore.removeParkedOrder(holdNumber);
  checkoutNotice.value = result;
}

async function handlePaymentConfirm() {
  checkoutNotice.value = null;
  const result = await posStore.completeCheckout();
  
  if (result.ok && result.order) {
    paymentStore.closePaymentModal();
    // Show receipt modal instead of notice
    selectedOrder.value = result.order;
    isReceiptModalOpen.value = true;
  } else {
    // Show the sale recording error without implying that a payment was attempted.
    checkoutNotice.value = result;
  }
}

function handlePaymentCancel() {
  paymentStore.closePaymentModal();
}

function closeReceiptModal() {
  isReceiptModalOpen.value = false;
  selectedOrder.value = null;
  checkoutNotice.value = null; // Clear any existing notice
}

async function handleDownloadPDF() {
  if (!selectedOrder.value) return;
  try {
    isPdfGenerating.value = true;
    await generatePDF(selectedOrder.value.orderNumber);
  } catch {
    alert("Failed to generate PDF. Please try again.");
  } finally {
    isPdfGenerating.value = false;
  }
}

function handlePrint() {
  if (!selectedOrder.value) return;
  printReceipt(selectedOrder.value.orderNumber);
}
</script>

<template>
  <div class="min-h-screen bg-slate-950 text-slate-100">
    <AppNavbar />

    <!-- Main Content -->
    <main class="mx-auto max-w-7xl px-4 py-4 sm:px-6 sm:py-6 lg:px-8 lg:py-8">
      <div class="mb-4 flex items-center justify-between gap-3 lg:hidden">
        <div>
          <p class="text-xs font-semibold uppercase tracking-widest text-sky-300">Point of sale</p>
          <h1 class="mt-1 text-xl font-semibold text-white">New sale</h1>
        </div>
        <a href="#cart-panel" class="inline-flex min-h-11 shrink-0 items-center rounded-xl border border-slate-700 bg-slate-800 px-4 text-sm font-semibold text-white hover:bg-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400">Cart ({{ posStore.totalItems }})<span class="hidden sm:inline"> · {{ formatCurrency(posStore.grandTotal) }}</span></a>
      </div>
      <section class="mb-8 hidden overflow-hidden rounded-[2rem] border border-slate-800/40 bg-gradient-to-r from-slate-900 via-slate-950 to-slate-900 p-6 shadow-2xl shadow-slate-950/40 lg:block">
        <div class="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div class="max-w-2xl">
            <p class="text-xs uppercase tracking-[0.24em] text-sky-300">Point of Sale</p>
            <h1 class="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl">A cleaner, faster way to manage sales</h1>
            <p class="mt-4 text-sm leading-7 text-slate-300 sm:text-base">Browse products, add items to cart, apply coupons, and complete checkout from one polished sales interface.</p>
          </div>
          <div class="grid gap-4 sm:grid-cols-3">
            <div class="rounded-3xl border border-slate-800/70 bg-slate-900/80 p-4 shadow-sm">
              <p class="text-xs uppercase tracking-[0.24em] text-slate-400">Cart items</p>
              <p class="mt-3 text-3xl font-semibold text-white">{{ posStore.totalItems }}</p>
            </div>
            <div class="rounded-3xl border border-slate-800/70 bg-slate-900/80 p-4 shadow-sm">
              <p class="text-xs uppercase tracking-[0.24em] text-slate-400">Saved coupons</p>
              <p class="mt-3 text-3xl font-semibold text-white">{{ couponsStore.totalCoupons ?? 0 }}</p>
            </div>
            <div class="rounded-3xl border border-slate-800/70 bg-slate-900/80 p-4 shadow-sm">
              <p class="text-xs uppercase tracking-[0.24em] text-slate-400">Quick checkout</p>
              <p class="mt-3 text-3xl font-semibold text-white">Fast workflow</p>
            </div>
          </div>
        </div>
      </section>

      <div class="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <section id="product-catalog" class="scroll-mt-24 rounded-[1.75rem] border border-slate-200 bg-white p-4 shadow-sm sm:p-6 xl:col-span-2">
          <div class="mb-6 flex flex-col gap-4">
            <div>
              <h2 class="text-lg font-semibold text-slate-900">Product Catalog</h2>
              <p class="mt-1 text-sm text-slate-500">Search, browse, and add items to the current sale.</p>
            </div>
            <div class="grid w-full gap-3 md:grid-cols-2">
              <div class="relative w-full">
                <svg class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-4.35-4.35M11 19a8 8 0 100-16 8 8 0 000 16z" />
                </svg>
                <input v-model="posStore.searchTerm" type="text" placeholder="Search products or category" class="w-full rounded-2xl border border-slate-300 bg-slate-50 px-10 py-3 text-sm text-slate-700 placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100" />
              </div>
              <div class="relative w-full">
                <svg class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 7h16M4 12h4m-4 5h16" />
                </svg>
                <input
                  ref="barcodeInputElement"
                  v-model="barcodeInput"
                  :disabled="posStore.isHoldPending"
                  @keydown.enter.prevent="handleBarcodeSubmit"
                  type="text"
                  aria-label="Scan or type a barcode or SKU"
                  autocomplete="off"
                  placeholder="Scan or type barcode / SKU"
                  class="w-full rounded-2xl border border-slate-300 bg-slate-50 px-10 py-3 pr-28 text-sm text-slate-700 placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                />
                <button
                  type="button"
                  @click="handleBarcodeSubmit"
                  :disabled="posStore.isHoldPending"
                  class="absolute right-1 top-1/2 -translate-y-1/2 rounded-2xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                >
                  Add
                </button>
              </div>
            </div>
          </div>

          <div class="-mt-3 mb-4 flex flex-wrap items-center gap-3">
            <p class="text-xs text-slate-500">Matching barcodes add automatically. Press Enter or Add to check a code manually.</p>
            <button type="button" :disabled="posStore.isHoldPending" :aria-expanded="showPhoneScanner" aria-controls="phone-barcode-scanner" class="inline-flex min-h-11 items-center rounded-xl border border-sky-300 bg-sky-50 px-4 py-2 text-sm font-semibold text-sky-900 hover:bg-sky-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 disabled:cursor-not-allowed disabled:opacity-50" @click="showPhoneScanner = !showPhoneScanner">{{ showPhoneScanner ? 'Hide camera scanner' : 'Scan with phone camera' }}</button>
          </div>
          <p v-if="barcodeNotice" role="status" aria-live="polite" class="mb-4 rounded-2xl border px-4 py-2 text-sm" :class="barcodeNotice.ok ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-rose-200 bg-rose-50 text-rose-700'">{{ barcodeNotice.message }}</p>
          <PhoneBarcodeScanner v-if="showPhoneScanner" @detected="handleCameraDetected" @close="showPhoneScanner = false" />

          <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <article v-for="product in posStore.filteredProducts" :key="product.id" class="group rounded-[1.5rem] border border-slate-200 bg-slate-50 p-5 shadow-sm transition duration-200 hover:-translate-y-1 hover:border-blue-200 hover:shadow-lg">
              <div class="flex items-center justify-between gap-4">
                <span class="min-w-0 truncate text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">{{ product.category }}</span>
                <div class="flex items-center gap-2">
                  <span 
                    class="rounded-full px-2 py-1 text-xs font-semibold"
                    :class="{
                      'bg-red-100 text-red-700': (product.stock || 0) === 0,
                      'bg-amber-100 text-amber-700': (product.stock || 0) > 0 && (product.stock || 0) <= (product.lowStockThreshold || 0),
                      'bg-emerald-100 text-emerald-700': (product.stock || 0) > (product.lowStockThreshold || 0)
                    }"
                  >
                    Stock: {{ product.stock || 0 }}
                  </span>
                  <span v-if="(product.stock || 0) <= (product.lowStockThreshold || 0)" class="text-xs">⚠️</span>
                </div>
              </div>
              <p class="mt-3 text-xs uppercase tracking-[0.24em] text-slate-500">SKU: {{ product.sku || product.id }}</p>
              <h3 class="mt-2 text-base font-semibold text-slate-900">{{ product.name }}</h3>
              <p class="mt-3 text-lg font-bold text-blue-700">{{ formatCurrency(product.price) }}</p>
              <button 
                class="mt-6 inline-flex w-full items-center justify-center rounded-2xl px-4 py-2 text-sm font-semibold text-white transition" 
                :class="{
                  'bg-blue-600 hover:bg-blue-500': (product.stock || 0) > 0,
                  'bg-slate-400 cursor-not-allowed': (product.stock || 0) === 0
                }"
                :disabled="(product.stock || 0) === 0 || posStore.isHoldPending"
                @click="addProductToCart(product)"
              >
                {{ (product.stock || 0) === 0 ? 'Out of Stock' : 'Add to Cart' }}
              </button>
            </article>
          </div>

          <p v-if="posStore.filteredProducts.length === 0" class="mt-6 rounded-[1.5rem] border border-dashed border-slate-300 bg-slate-50 px-6 py-10 text-center text-sm text-slate-500">{{ posStore.products.length === 0 ? 'No products yet. An admin or manager can add products from the Products page.' : 'No products matched your search. Try another keyword or clear the filter.' }}</p>
        </section>

        <aside id="cart-panel" class="scroll-mt-24 rounded-[1.75rem] border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
          <div class="mb-5 flex items-center justify-between">
            <div>
              <p class="text-sm font-medium text-slate-500">Current Sale</p>
              <p class="mt-1 text-3xl font-semibold text-slate-900">{{ posStore.totalItems }} items</p>
            </div>
            <a href="#product-catalog" class="inline-flex rounded-full bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-100 lg:hidden">Add items</a>
            <span class="hidden rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700 lg:inline-flex">Ready</span>
          </div>

          <div class="space-y-4">
            <div v-for="item in posStore.cartItems" :key="item.productId" class="rounded-3xl border border-slate-200 bg-slate-50 p-4">
              <div class="flex items-start justify-between gap-3">
                <div class="min-w-0">
                  <p class="text-sm font-semibold text-slate-900">{{ item.name }}</p>
                  <p class="mt-1 text-xs text-slate-500">{{ formatCurrency(item.price) }} each</p>
                </div>
                <button class="text-xs font-semibold text-rose-600 hover:text-rose-500 disabled:opacity-50" :disabled="posStore.isHoldPending" @click="posStore.removeFromCart(item.productId)">Remove</button>
              </div>

              <div class="mt-4 flex items-center justify-between gap-3">
                <div class="inline-flex items-center rounded-full border border-slate-300 bg-white">
                  <button class="px-3 py-2 text-slate-600 hover:bg-slate-100 disabled:opacity-50" :disabled="posStore.isHoldPending" @click="decreaseQuantity(item)">-</button>
                  <span class="min-w-[2.25rem] border-x border-slate-300 px-3 py-2 text-center text-sm font-semibold text-slate-700">{{ item.quantity }}</span>
                  <button class="px-3 py-2 text-slate-600 hover:bg-slate-100 disabled:opacity-50" :disabled="posStore.isHoldPending" @click="increaseQuantity(item)">+</button>
                </div>
                <p class="text-sm font-semibold text-slate-900">{{ formatCurrency(lineTotal(item.price, item.quantity)) }}</p>
              </div>
            </div>

            <div v-if="posStore.cartItems.length === 0" class="rounded-3xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm text-slate-500">No items in cart yet. Add a product to begin checkout.</div>
          </div>

          <!-- Coupon Application Section -->
          <div v-if="posStore.cartItems.length > 0" class="mt-5 rounded-3xl border border-slate-200 bg-slate-50 p-4">
            <p class="text-sm font-medium text-slate-700">Apply Coupon</p>
            <div v-if="!posStore.appliedCoupon" class="mt-3 flex gap-2">
              <input
                v-model="posStore.couponCode"
                :disabled="posStore.isHoldPending"
                type="text"
                placeholder="Enter coupon code"
                class="flex-1 rounded-2xl border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
              />
              <button
                class="rounded-2xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-500"
                @click="posStore.applyCoupon"
                :disabled="posStore.isHoldPending"
              >
                Apply
              </button>
            </div>
            <div v-if="posStore.couponError" class="mt-2 rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-600">{{ posStore.couponError }}</div>
            <div v-if="posStore.appliedCoupon" class="mt-3 flex items-center justify-between rounded-2xl border border-emerald-200 bg-emerald-50 p-3">
              <div>
                <p class="text-sm font-semibold text-emerald-700">{{ posStore.appliedCoupon.code }}</p>
                <p class="text-xs text-emerald-600">{{ posStore.appliedCoupon.description }}</p>
              </div>
              <button
                class="text-xs font-semibold text-emerald-600 hover:text-emerald-700"
                @click="posStore.removeCoupon"
                :disabled="posStore.isHoldPending"
              >
                Remove
              </button>
            </div>
          </div>

          <div class="mt-6 rounded-3xl border border-slate-200 bg-slate-50 p-4">
            <div class="flex justify-between text-sm text-slate-600"><span>Subtotal</span><span>{{ formatCurrency(posStore.subtotal) }}</span></div>
            <div v-if="posStore.appliedCoupon" class="mt-3 flex justify-between text-sm font-medium text-emerald-600"><span>Discount</span><span>-{{ formatCurrency(posStore.discountAmount) }}</span></div>
            <div class="mt-3 flex justify-between text-sm text-slate-600"><span>Tax ({{ posStore.taxRateSummary }})</span><span>{{ formatCurrency(posStore.taxAmount) }}</span></div>
            <div class="mt-4 flex justify-between text-base font-semibold text-slate-900"><span>Total</span><span>{{ formatCurrency(posStore.grandTotal) }}</span></div>
          </div>

          <div class="mt-5 rounded-3xl border border-slate-200 bg-slate-50 p-4">
            <p class="text-sm font-medium text-slate-700">Hold Details (Optional)</p>
            <div class="mt-3 space-y-2">
              <input
                v-model="parkedCustomerLabel"
                :disabled="posStore.hasPendingHold"
                type="text"
                maxlength="60"
                placeholder="Customer name or reference"
                class="w-full rounded-2xl border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 placeholder-slate-400 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-100"
              />
              <textarea
                v-model="parkedOrderNote"
                :disabled="posStore.hasPendingHold"
                maxlength="140"
                rows="2"
                placeholder="Short note (e.g. waiting for one more item)"
                class="w-full resize-none rounded-2xl border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 placeholder-slate-400 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-100"
              />
            </div>
          </div>

          <div class="mt-5 rounded-3xl border border-slate-200 bg-slate-50 p-4">
            <div class="flex items-center justify-between">
              <p class="text-sm font-medium text-slate-700">Parked Orders</p>
              <span class="inline-flex rounded-full bg-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-700">{{ posStore.totalParkedOrders }}</span>
            </div>

            <div class="mt-3 space-y-3" v-if="posStore.parkedOrders.length > 0">
              <div v-for="parkedOrder in posStore.parkedOrders" :key="parkedOrder.holdNumber" class="rounded-2xl border border-slate-200 bg-white p-3">
                <div class="flex items-start justify-between gap-3">
                  <div>
                    <p class="text-sm font-semibold text-slate-900">{{ parkedOrder.holdNumber }}</p>
                    <p v-if="parkedOrder.customerLabel" class="mt-1 text-xs font-semibold uppercase tracking-[0.2em] text-amber-700">{{ parkedOrder.customerLabel }}</p>
                    <p class="mt-1 text-xs text-slate-500">{{ formatDateTime(parkedOrder.parkedAt) }} · {{ parkedOrder.itemCount }} {{ parkedOrder.itemCount === 1 ? 'item' : 'items' }}</p>
                    <p v-if="parkedOrder.note" class="mt-1 text-xs text-slate-600">{{ parkedOrder.note }}</p>
                    <p class="mt-2 text-sm font-medium text-slate-800">{{ formatCurrency(parkedOrder.total) }}</p>
                  </div>
                  <button
                    type="button"
                    class="text-xs font-semibold text-rose-600 hover:text-rose-500"
                    @click="removeParkedOrder(parkedOrder.holdNumber)"
                    :disabled="posStore.isHoldPending"
                  >
                    Remove
                  </button>
                </div>

                <button
                  type="button"
                  class="mt-3 inline-flex w-full items-center justify-center rounded-2xl border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700 transition hover:bg-blue-100"
                  @click="recallParkedOrder(parkedOrder.holdNumber)"
                  :disabled="posStore.hasPendingHold || posStore.isRecalling || (posStore.pendingRecallNumber && posStore.pendingRecallNumber !== parkedOrder.holdNumber)"
                >
                  {{ posStore.pendingRecallNumber === parkedOrder.holdNumber ? 'Retry Recall' : 'Recall Order' }}
                </button>
              </div>
            </div>

            <p v-else class="mt-3 rounded-2xl border border-dashed border-slate-300 bg-white px-3 py-4 text-center text-xs text-slate-500">
              No parked orders yet.
            </p>
          </div>

          <div class="mt-5 grid gap-3">
            <button class="rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50" :disabled="posStore.cartItems.length === 0 || posStore.isPreparingCheckout || posStore.isHoldPending" @click="checkoutSale">{{ posStore.isPreparingCheckout ? 'Checking stock...' : 'Checkout' }}</button>
            <button class="rounded-2xl bg-amber-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-amber-500 disabled:cursor-not-allowed disabled:opacity-50" :disabled="posStore.cartItems.length === 0 || posStore.isPreparingCheckout || posStore.isHolding || Boolean(posStore.pendingRecallNumber)" @click="holdCurrentOrder">{{ posStore.hasPendingHold ? 'Retry Hold Order' : 'Hold Order' }}</button>
            <button class="rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50" :disabled="posStore.cartItems.length === 0 || posStore.isPreparingCheckout || posStore.isHoldPending" @click="posStore.clearCart()">Clear Cart</button>
          </div>

          <div v-if="checkoutNotice" class="mt-4 rounded-2xl border px-3 py-3 text-sm" :class="checkoutNotice.ok ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-rose-200 bg-rose-50 text-rose-700'">{{ checkoutNotice.message }}</div>
        </aside>
      </div>
    </main>

    <!-- Payment Modal -->
    <PaymentModal
      v-if="paymentStore.isPaymentModalOpen"
      :total-amount="posStore.grandTotal"
      :error-message="checkoutNotice?.ok === false ? checkoutNotice.message : ''"
      :is-submitting="posStore.isCompletingCheckout"
      @confirm="handlePaymentConfirm"
      @cancel="handlePaymentCancel"
    />

    <!-- Receipt Modal (shown after recording a sale) -->
    <div v-if="isReceiptModalOpen" class="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
      <div class="relative w-full max-w-2xl max-h-[90vh] bg-white rounded-2xl shadow-2xl overflow-auto">
        <!-- Modal Header -->
        <div class="sticky top-0 flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4">
          <div>
            <h2 class="text-lg font-semibold text-slate-900">Sale Recorded</h2>
            <p class="mt-1 text-sm text-slate-500">Receipt - {{ selectedOrder?.orderNumber }}</p>
            <p v-if="selectedOrder?.payment?.paymentMethod === 'credit'" class="mt-2 text-sm font-medium text-amber-800">Utang recorded for {{ selectedOrder.credit?.customerName }}. {{ formatCurrency(selectedOrder.credit?.balance ?? selectedOrder.total) }} remains unpaid.</p>
            <p v-else-if="selectedOrder?.payment?.paymentMethod !== 'cash'" class="mt-2 text-sm font-medium text-amber-800">{{ selectedOrder?.payment?.paymentMethod === 'card' ? 'Card' : 'E-wallet' }} method recorded. Mini POS did not charge or verify this payment.</p>
            <p v-else class="mt-2 text-sm text-slate-600">Cash amount recorded.</p>
          </div>
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
            <ReceiptView v-if="selectedOrder" :order="selectedOrder" />
          </div>
        </div>

        <!-- Modal Footer -->
        <div class="sticky bottom-0 border-t border-slate-200 bg-white px-6 py-4 flex gap-3 justify-end">
          <button
            @click="closeReceiptModal"
            class="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition"
          >
            Done
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

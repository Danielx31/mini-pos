<script setup>
import { ref } from "vue";
import { usePosStore } from "../stores/pos";
import { useCouponsStore } from "../stores/coupons";
import { usePaymentStore } from "../stores/payment";
import { useCurrency } from "../composables/useFormatters";
import AppNavbar from "../components/AppNavbar.vue";
import PaymentModal from "../components/PaymentModal.vue";

const posStore = usePosStore();
const couponsStore = useCouponsStore();
const paymentStore = usePaymentStore();
const { formatCurrency } = useCurrency();
const checkoutNotice = ref(null);

function addProductToCart(product) {
  posStore.addToCart(product);
  checkoutNotice.value = null;
}

function decreaseQuantity(item) {
  posStore.updateQuantity(item.productId, item.quantity - 1);
}

function increaseQuantity(item) {
  posStore.updateQuantity(item.productId, item.quantity + 1);
}

function checkoutSale() {
  const result = posStore.initiateCheckout();
  
  if (!result.ok) {
    checkoutNotice.value = result;
    return;
  }
  
  paymentStore.openPaymentModal();
}

function handlePaymentConfirm() {
  paymentStore.closePaymentModal();
  const result = posStore.completeCheckout();
  checkoutNotice.value = result;
}

function handlePaymentCancel() {
  paymentStore.closePaymentModal();
}
</script>

<template>
  <div class="min-h-screen bg-slate-950 text-slate-100">
    <AppNavbar />

    <!-- Main Content -->
    <main class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <section class="mb-8 overflow-hidden rounded-[2rem] border border-slate-800/40 bg-gradient-to-r from-slate-900 via-slate-950 to-slate-900 p-6 shadow-2xl shadow-slate-950/40">
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
        <section class="xl:col-span-2 rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm">
          <div class="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 class="text-lg font-semibold text-slate-900">Product Catalog</h2>
              <p class="mt-1 text-sm text-slate-500">Search, browse, and add items to the current sale.</p>
            </div>
            <div class="relative w-full sm:w-auto">
              <svg class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-4.35-4.35M11 19a8 8 0 100-16 8 8 0 000 16z" />
              </svg>
              <input v-model="posStore.searchTerm" type="text" placeholder="Search products or category" class="w-full rounded-2xl border border-slate-300 bg-slate-50 px-10 py-3 text-sm text-slate-700 placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100" />
            </div>
          </div>

          <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <article v-for="product in posStore.filteredProducts" :key="product.id" class="group rounded-[1.5rem] border border-slate-200 bg-slate-50 p-5 shadow-sm transition duration-200 hover:-translate-y-1 hover:border-blue-200 hover:shadow-lg">
              <div class="flex items-center justify-between gap-4">
                <span class="text-xs font-semibold uppercase tracking-[0.32em] text-slate-500">{{ product.category }}</span>
                <span class="rounded-full bg-blue-500/10 px-3 py-1 text-xs font-semibold text-blue-700">NEW</span>
              </div>
              <h3 class="mt-4 text-base font-semibold text-slate-900">{{ product.name }}</h3>
              <p class="mt-3 text-lg font-bold text-blue-700">{{ formatCurrency(product.price) }}</p>
              <button class="mt-6 inline-flex w-full items-center justify-center rounded-2xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-500" @click="addProductToCart(product)">Add to Cart</button>
            </article>
          </div>

          <p v-if="posStore.filteredProducts.length === 0" class="mt-6 rounded-[1.5rem] border border-dashed border-slate-300 bg-slate-50 px-6 py-10 text-center text-sm text-slate-500">No products matched your search. Try another keyword or clear the filter.</p>
        </section>

        <aside class="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm">
          <div class="mb-5 flex items-center justify-between">
            <div>
              <p class="text-sm font-medium text-slate-500">Current Sale</p>
              <p class="mt-1 text-3xl font-semibold text-slate-900">{{ posStore.totalItems }} items</p>
            </div>
            <span class="inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">Ready</span>
          </div>

          <div class="space-y-4">
            <div v-for="item in posStore.cartItems" :key="item.productId" class="rounded-3xl border border-slate-200 bg-slate-50 p-4">
              <div class="flex items-start justify-between gap-3">
                <div class="min-w-0">
                  <p class="text-sm font-semibold text-slate-900">{{ item.name }}</p>
                  <p class="mt-1 text-xs text-slate-500">{{ formatCurrency(item.price) }} each</p>
                </div>
                <button class="text-xs font-semibold text-rose-600 hover:text-rose-500" @click="posStore.removeFromCart(item.productId)">Remove</button>
              </div>

              <div class="mt-4 flex items-center justify-between gap-3">
                <div class="inline-flex items-center rounded-full border border-slate-300 bg-white">
                  <button class="px-3 py-2 text-slate-600 hover:bg-slate-100" @click="decreaseQuantity(item)">-</button>
                  <span class="min-w-[2.25rem] border-x border-slate-300 px-3 py-2 text-center text-sm font-semibold text-slate-700">{{ item.quantity }}</span>
                  <button class="px-3 py-2 text-slate-600 hover:bg-slate-100" @click="increaseQuantity(item)">+</button>
                </div>
                <p class="text-sm font-semibold text-slate-900">{{ formatCurrency(item.quantity * item.price) }}</p>
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
                type="text"
                placeholder="Enter coupon code"
                class="flex-1 rounded-2xl border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
              />
              <button
                class="rounded-2xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-500"
                @click="posStore.applyCoupon"
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
              >
                Remove
              </button>
            </div>
          </div>

          <div class="mt-6 rounded-3xl border border-slate-200 bg-slate-50 p-4">
            <div class="flex justify-between text-sm text-slate-600"><span>Subtotal</span><span>{{ formatCurrency(posStore.subtotal) }}</span></div>
            <div v-if="posStore.appliedCoupon" class="mt-3 flex justify-between text-sm font-medium text-emerald-600"><span>Discount</span><span>-{{ formatCurrency(posStore.discountAmount) }}</span></div>
            <div class="mt-3 flex justify-between text-sm text-slate-600"><span>Tax (8%)</span><span>{{ formatCurrency(posStore.taxAmount) }}</span></div>
            <div class="mt-4 flex justify-between text-base font-semibold text-slate-900"><span>Total</span><span>{{ formatCurrency(posStore.grandTotal) }}</span></div>
          </div>

          <div class="mt-5 grid gap-3">
            <button class="rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50" :disabled="posStore.cartItems.length === 0" @click="checkoutSale">Checkout</button>
            <button class="rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50" :disabled="posStore.cartItems.length === 0" @click="posStore.clearCart()">Clear Cart</button>
          </div>

          <div v-if="checkoutNotice" class="mt-4 rounded-2xl border px-3 py-3 text-sm" :class="checkoutNotice.ok ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-rose-200 bg-rose-50 text-rose-700'">{{ checkoutNotice.message }}</div>
        </aside>
      </div>
    </main>

    <!-- Payment Modal -->
    <PaymentModal
      v-if="paymentStore.isPaymentModalOpen"
      :total-amount="posStore.grandTotal"
      @confirm="handlePaymentConfirm"
      @cancel="handlePaymentCancel"
    />
  </div>
</template>

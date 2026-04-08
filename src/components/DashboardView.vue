<script setup>
import { ref } from "vue";
import { usePosStore } from "../stores/pos";
import { useCurrency } from "../composables/useFormatters";
import AppNavbar from "./AppNavbar.vue";

const posStore = usePosStore();
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
  checkoutNotice.value = posStore.checkout();
}
</script>

<template>
  <div class="min-h-screen bg-slate-50">
    <AppNavbar />

    <!-- Main Content -->
    <main class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div class="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <section
          class="xl:col-span-2 rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
        >
          <div
            class="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
          >
            <h2 class="text-lg font-semibold text-slate-800">
              Product Catalog
            </h2>
            <input
              v-model="posStore.searchTerm"
              type="text"
              placeholder="Search products or category"
              class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100 sm:max-w-xs"
            />
          </div>

          <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <article
              v-for="product in posStore.filteredProducts"
              :key="product.id"
              class="rounded-lg border border-slate-200 bg-slate-50 p-4"
            >
              <p
                class="text-xs font-medium uppercase tracking-wide text-slate-500"
              >
                {{ product.category }}
              </p>
              <h3 class="mt-1 text-sm font-semibold text-slate-800">
                {{ product.name }}
              </h3>
              <p class="mt-2 text-base font-bold text-blue-700">
                {{ formatCurrency(product.price) }}
              </p>
              <button
                class="mt-3 w-full rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-500"
                @click="addProductToCart(product)"
              >
                Add to Cart
              </button>
            </article>
          </div>

          <p
            v-if="posStore.filteredProducts.length === 0"
            class="rounded-lg border border-dashed border-slate-300 py-6 text-center text-sm text-slate-500"
          >
            No products matched your search.
          </p>
        </section>

        <aside
          class="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
        >
          <div class="mb-4 flex items-center justify-between">
            <h2 class="text-lg font-semibold text-slate-800">Current Sale</h2>
            <span
              class="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700"
            >
              {{ posStore.totalItems }} items
            </span>
          </div>

          <div class="space-y-3">
            <div
              v-for="item in posStore.cartItems"
              :key="item.productId"
              class="rounded-lg border border-slate-200 p-3"
            >
              <div class="flex items-start justify-between gap-2">
                <div>
                  <p class="text-sm font-medium text-slate-800">
                    {{ item.name }}
                  </p>
                  <p class="text-xs text-slate-500">
                    {{ formatCurrency(item.price) }} each
                  </p>
                </div>
                <button
                  class="text-xs font-medium text-rose-600 hover:text-rose-500"
                  @click="posStore.removeFromCart(item.productId)"
                >
                  Remove
                </button>
              </div>

              <div class="mt-3 flex items-center justify-between">
                <div
                  class="inline-flex items-center rounded-lg border border-slate-300"
                >
                  <button
                    class="px-2 py-1 text-slate-600 hover:bg-slate-100"
                    @click="decreaseQuantity(item)"
                  >
                    -
                  </button>
                  <span
                    class="min-w-10 border-x border-slate-300 px-2 py-1 text-center text-sm text-slate-700"
                  >
                    {{ item.quantity }}
                  </span>
                  <button
                    class="px-2 py-1 text-slate-600 hover:bg-slate-100"
                    @click="increaseQuantity(item)"
                  >
                    +
                  </button>
                </div>
                <p class="text-sm font-semibold text-slate-800">
                  {{ formatCurrency(item.quantity * item.price) }}
                </p>
              </div>
            </div>

            <p
              v-if="posStore.cartItems.length === 0"
              class="rounded-lg border border-dashed border-slate-300 py-5 text-center text-sm text-slate-500"
            >
              Cart is empty.
            </p>
          </div>

          <div class="mt-5 border-t border-slate-200 pt-4 text-sm">
            <div class="mb-1 flex justify-between text-slate-600">
              <span>Subtotal</span>
              <span>{{ formatCurrency(posStore.subtotal) }}</span>
            </div>
            <div class="mb-1 flex justify-between text-slate-600">
              <span>Tax (8%)</span>
              <span>{{ formatCurrency(posStore.taxAmount) }}</span>
            </div>
            <div
              class="flex justify-between text-base font-semibold text-slate-900"
            >
              <span>Total</span>
              <span>{{ formatCurrency(posStore.grandTotal) }}</span>
            </div>
          </div>

          <button
            class="mt-5 w-full rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
            :disabled="posStore.cartItems.length === 0"
            @click="checkoutSale"
          >
            Checkout
          </button>

          <button
            class="mt-2 w-full rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
            :disabled="posStore.cartItems.length === 0"
            @click="posStore.clearCart()"
          >
            Clear Cart
          </button>

          <div
            v-if="checkoutNotice"
            class="mt-4 rounded-lg border px-3 py-2 text-sm"
            :class="
              checkoutNotice.ok
                ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                : 'border-rose-200 bg-rose-50 text-rose-700'
            "
          >
            {{ checkoutNotice.message }}
          </div>
        </aside>
      </div>
    </main>
  </div>
</template>

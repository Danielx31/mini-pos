<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { useCurrency } from "../composables/useFormatters";
import { api } from "../lib/api";
import ProductPhotoCarousel from "../components/ProductPhotoCarousel.vue";

type MenuProduct = {
  name: string;
  category: string;
  icon: string | null;
  images: { id: string; url: string }[];
  price: number;
};

type CategoryAppearance = {
  background: string;
  badge: string;
  symbol: string;
};

const CATEGORY_APPEARANCES: Record<string, CategoryAppearance> = {
  biscuits: { background: "bg-gradient-to-br from-amber-100 via-orange-50 to-yellow-200", badge: "bg-amber-50 text-amber-900", symbol: "🍪" },
  chocolate: { background: "bg-gradient-to-br from-rose-100 via-pink-50 to-orange-200", badge: "bg-rose-50 text-rose-900", symbol: "🍫" },
  drinks: { background: "bg-gradient-to-br from-sky-100 via-cyan-50 to-teal-200", badge: "bg-sky-50 text-sky-900", symbol: "🥤" },
  snacks: { background: "bg-gradient-to-br from-lime-100 via-yellow-50 to-emerald-200", badge: "bg-lime-50 text-lime-900", symbol: "🍿" },
};
const DEFAULT_APPEARANCE: CategoryAppearance = {
  background: "bg-gradient-to-br from-stone-100 via-slate-50 to-emerald-100",
  badge: "bg-stone-100 text-stone-800",
  symbol: "✦",
};

function categoryAppearance(category: string): CategoryAppearance {
  return CATEGORY_APPEARANCES[category.toLocaleLowerCase()] ?? DEFAULT_APPEARANCE;
}

const VIBER_NUMBER = "09757644715";
const VIBER_CONTACT = "Daniel B.";
const { formatCurrency } = useCurrency();
const products = ref<MenuProduct[]>([]);
const searchTerm = ref("");
const selectedCategory = ref("");
const isLoading = ref(true);
const errorMessage = ref("");
const copyStatus = ref<"idle" | "copied" | "error">("idle");
const selectedProduct = ref<MenuProduct | null>(null);
const dialogPanel = ref<HTMLElement | null>(null);
const closeButton = ref<HTMLButtonElement | null>(null);
const SWIPE_THRESHOLD_PX = 40;
const SWIPE_CLICK_DELAY_MS = 400;
let touchStartX = 0;
let lastSwipeAt = 0;
let previousFocus: HTMLElement | null = null;
let bodyHadOverflowHidden = false;

const categories = computed(() =>
  [...new Set(products.value.map((product) => product.category))].sort(),
);

const visibleProducts = computed(() => {
  const search = searchTerm.value.trim().toLocaleLowerCase();
  return products.value.filter((product) =>
    (!selectedCategory.value || product.category === selectedCategory.value) &&
    (!search || `${product.name} ${product.category}`.toLocaleLowerCase().includes(search)),
  );
});

async function loadMenu() {
  isLoading.value = true;
  errorMessage.value = "";
  try {
    const result = await api("/menu");
    if (!Array.isArray(result)) throw new Error("The menu is unavailable right now.");
    products.value = result as MenuProduct[];
    if (selectedProduct.value && !products.value.some((product) =>
      product.name === selectedProduct.value?.name && product.category === selectedProduct.value?.category,
    )) closeProduct();
    if (selectedCategory.value && !categories.value.includes(selectedCategory.value)) {
      selectedCategory.value = "";
    }
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : "The menu is unavailable right now.";
  } finally {
    isLoading.value = false;
  }
}

async function copyViberNumber() {
  try {
    await navigator.clipboard.writeText(VIBER_NUMBER);
    copyStatus.value = "copied";
  } catch {
    copyStatus.value = "error";
  }
}

function openProduct(product: MenuProduct): void {
  copyStatus.value = "idle";
  selectedProduct.value = product;
}

function closeProduct(): void {
  selectedProduct.value = null;
}

function cardTouchStart(event: TouchEvent): void {
  touchStartX = event.touches[0]?.clientX ?? 0;
}

function cardTouchEnd(event: TouchEvent): void {
  const distance = (event.changedTouches[0]?.clientX ?? touchStartX) - touchStartX;
  if (Math.abs(distance) > SWIPE_THRESHOLD_PX) lastSwipeAt = Date.now();
}

function cardClicked(product: MenuProduct): void {
  if (Date.now() - lastSwipeAt < SWIPE_CLICK_DELAY_MS) return;
  openProduct(product);
}

function dialogKeydown(event: KeyboardEvent): void {
  if (event.key === "Escape") {
    closeProduct();
    return;
  }
  if (event.key !== "Tab" || !dialogPanel.value) return;
  const focusable = Array.from(dialogPanel.value.querySelectorAll<HTMLElement>(
    'button:not(:disabled), a[href], input:not(:disabled), [tabindex]:not([tabindex="-1"])',
  ));
  if (!focusable.length) return;
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last?.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first?.focus();
  }
}

watch(selectedProduct, async (product, previous) => {
  if (product) {
    if (!previous) {
      previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      bodyHadOverflowHidden = document.body.classList.contains("overflow-hidden");
      document.body.classList.add("overflow-hidden");
    }
    await nextTick();
    closeButton.value?.focus();
  } else if (previous) {
    if (!bodyHadOverflowHidden) document.body.classList.remove("overflow-hidden");
    await nextTick();
    previousFocus?.focus();
    previousFocus = null;
  }
});

onBeforeUnmount(() => {
  if (selectedProduct.value && !bodyHadOverflowHidden) document.body.classList.remove("overflow-hidden");
});

onMounted(loadMenu);
</script>

<template>
  <div class="min-h-screen bg-[#f6f5ef] text-slate-900">
    <header class="border-b border-emerald-950/10 bg-white">
      <div class="mx-auto flex max-w-7xl items-center justify-between px-4 py-5 sm:px-6 lg:px-8">
        <div>
          <span class="block text-xl font-black tracking-tight text-emerald-950">Mini POS<span class="text-orange-500">.</span></span>
          <span class="block text-[0.65rem] font-bold uppercase tracking-[0.25em] text-emerald-800">Customer menu</span>
        </div>
        <span class="hidden rounded-full bg-emerald-50 px-4 py-2 text-xs font-bold uppercase tracking-widest text-emerald-800 sm:inline-flex">Browse · Choose · Message</span>
      </div>
    </header>

    <main class="mx-auto max-w-7xl px-4 pb-16 sm:px-6 lg:px-8">
      <section class="relative mt-5 overflow-hidden rounded-[2rem] bg-emerald-950 text-white shadow-xl shadow-emerald-950/15 sm:mt-8 sm:rounded-[2.5rem]">
        <div class="pointer-events-none absolute -right-20 -top-28 h-80 w-80 rounded-full border-[3rem] border-white/5" aria-hidden="true" />
        <div class="pointer-events-none absolute bottom-0 left-1/3 h-40 w-40 rounded-full bg-lime-300/10 blur-3xl" aria-hidden="true" />
        <div class="relative grid gap-10 px-6 py-9 sm:px-10 sm:py-12 lg:grid-cols-[minmax(0,1fr)_minmax(290px,370px)] lg:items-center lg:gap-16 lg:px-14 lg:py-16">
          <div class="min-w-0">
            <p class="inline-flex rounded-full border border-lime-200/30 bg-white/10 px-4 py-2 text-xs font-bold uppercase tracking-[0.2em] text-lime-200">Find your favorites</p>
            <h1 class="mt-6 max-w-2xl text-4xl font-black leading-[1.08] tracking-tight sm:text-5xl lg:text-6xl">Good choices, <span class="text-lime-300">ready to browse.</span></h1>
            <p class="mt-5 max-w-xl text-base leading-7 text-emerald-50/85 sm:text-lg">Explore what’s in stock, see prices in pesos, and message {{ VIBER_CONTACT }} with your picks.</p>
            <div class="mt-8 flex flex-wrap items-center gap-3">
              <a href="#available-menu" class="inline-flex items-center justify-center gap-2 rounded-full bg-lime-300 px-6 py-3 text-sm font-bold text-emerald-950 transition hover:bg-lime-200 focus:outline-none focus:ring-2 focus:ring-lime-200 focus:ring-offset-2 focus:ring-offset-emerald-950">
                Explore the menu <span aria-hidden="true">↓</span>
              </a>
              <span class="text-sm text-emerald-50/75">{{ isLoading ? 'Checking availability…' : `${products.length} ${products.length === 1 ? 'item' : 'items'} available now` }}</span>
            </div>
          </div>

          <div class="min-w-0 rounded-[1.75rem] bg-white p-5 text-slate-900 shadow-2xl shadow-black/15 sm:p-7" aria-labelledby="order-heading">
            <div class="flex items-center gap-3">
              <span class="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-violet-100 text-xl font-black text-violet-700" aria-hidden="true">V</span>
              <div>
                <p class="text-xs font-bold uppercase tracking-[0.18em] text-violet-700">Order on Viber</p>
                <h2 id="order-heading" class="text-xl font-black tracking-tight text-slate-950">Message {{ VIBER_CONTACT }}</h2>
              </div>
            </div>
            <p class="mt-5 text-sm leading-6 text-slate-600">Send the product names and quantities you want. Please wait for Daniel B. to confirm your order.</p>
            <div class="mt-5 rounded-2xl border border-violet-100 bg-violet-50 px-4 py-3">
              <p class="text-[0.7rem] font-bold uppercase tracking-widest text-violet-700">Viber number</p>
              <p class="mt-1 select-all text-2xl font-black tracking-tight text-slate-950">{{ VIBER_NUMBER }}</p>
            </div>
            <button type="button" class="mt-4 w-full rounded-2xl bg-violet-700 px-4 py-3.5 text-sm font-bold text-white transition hover:bg-violet-800 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:ring-offset-2" @click="copyViberNumber">
              {{ copyStatus === 'copied' ? 'Number copied ✓' : 'Copy Viber number' }}
            </button>
            <p v-if="copyStatus === 'error'" class="mt-3 text-xs text-rose-700" role="status">Couldn’t copy automatically. Please select the number above.</p>
            <p v-else class="mt-3 text-xs text-slate-500" aria-live="polite">{{ copyStatus === 'copied' ? 'Paste the number into Viber to find Daniel B.' : 'Copy the number and search for it in Viber.' }}</p>
          </div>
        </div>
      </section>

      <section id="available-menu" aria-labelledby="menu-heading" class="scroll-mt-8 py-12 sm:py-16">
        <div class="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p class="text-xs font-black uppercase tracking-[0.22em] text-emerald-800">The menu</p>
            <h2 id="menu-heading" class="mt-2 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">Available now<span class="text-orange-500">.</span></h2>
            <p class="mt-2 text-sm text-slate-600">{{ isLoading ? 'Checking availability…' : `${products.length} ${products.length === 1 ? 'product' : 'products'} ready to browse` }}</p>
          </div>
          <button type="button" :disabled="isLoading" class="inline-flex self-start items-center gap-2 rounded-full border border-emerald-200 bg-white px-5 py-3 text-sm font-bold text-emerald-900 shadow-sm transition hover:border-emerald-500 hover:bg-emerald-50 focus:outline-none focus:ring-2 focus:ring-emerald-600 disabled:cursor-wait disabled:opacity-50" @click="loadMenu">
            <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M20 11a8 8 0 0 0-14.9-4M4 4v4h4m-4 5a8 8 0 0 0 14.9 4M20 20v-4h-4" /></svg>
            {{ isLoading ? 'Refreshing…' : 'Refresh menu' }}
          </button>
        </div>

        <div v-if="errorMessage" class="mt-7 rounded-2xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-800" role="alert">{{ errorMessage }}</div>

        <template v-if="!isLoading && products.length > 0">
          <div class="mt-7 rounded-[1.75rem] border border-stone-200 bg-white p-4 shadow-sm sm:p-6">
            <label for="menu-search" class="mb-2 block text-sm font-bold text-slate-800">What are you looking for?</label>
            <div class="relative sm:max-w-xl">
              <svg class="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path stroke-linecap="round" d="m20 20-4-4" /></svg>
              <input id="menu-search" v-model="searchTerm" type="search" placeholder="Search products or categories" class="w-full rounded-2xl border border-stone-200 bg-[#f8f8f5] px-4 py-3.5 pl-12 text-base text-slate-900 placeholder-slate-500 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600" />
            </div>

            <div class="mt-5 flex gap-2 overflow-x-auto pb-1" role="group" aria-label="Filter by category">
              <button type="button" :aria-pressed="selectedCategory === ''" class="shrink-0 rounded-full px-5 py-2.5 text-sm font-bold transition focus:outline-none focus:ring-2 focus:ring-emerald-600" :class="selectedCategory === '' ? 'bg-emerald-900 text-white' : 'bg-stone-100 text-slate-700 hover:bg-stone-200'" @click="selectedCategory = ''">All products</button>
              <button v-for="category in categories" :key="category" type="button" :aria-pressed="selectedCategory === category" class="shrink-0 rounded-full px-5 py-2.5 text-sm font-bold transition focus:outline-none focus:ring-2 focus:ring-emerald-600" :class="selectedCategory === category ? 'bg-emerald-900 text-white' : 'bg-stone-100 text-slate-700 hover:bg-stone-200'" @click="selectedCategory = category">{{ category }}</button>
            </div>
          </div>

          <p class="mt-5 text-sm font-semibold text-slate-600" role="status">Showing {{ visibleProducts.length }} of {{ products.length }} products</p>

          <div v-if="visibleProducts.length > 0" class="mt-4 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            <article v-for="product in visibleProducts" :key="`${product.category}:${product.name}`" class="group cursor-pointer overflow-hidden rounded-[1.65rem] border border-stone-200 bg-white shadow-sm transition duration-200 hover:-translate-y-1 hover:border-emerald-200 hover:shadow-xl hover:shadow-emerald-950/10 focus-within:ring-2 focus-within:ring-emerald-600" @click="cardClicked(product)" @touchstart.passive="cardTouchStart" @touchend.passive="cardTouchEnd">
              <div class="relative h-44 overflow-hidden" :class="categoryAppearance(product.category).background">
                <ProductPhotoCarousel :images="product.images ?? []" :product-name="product.name" :fallback-icon="product.icon || categoryAppearance(product.category).symbol" />
              </div>
              <button type="button" class="flex min-h-48 w-full flex-col p-5 text-left focus:outline-none" :aria-label="`View details for ${product.name}`">
                <span class="self-start rounded-full px-3 py-1 text-[0.7rem] font-black uppercase tracking-wider" :class="categoryAppearance(product.category).badge">{{ product.category }}</span>
                <span class="mt-3 flex-1 text-lg font-bold leading-snug text-slate-950">{{ product.name }}</span>
                <span class="mt-5 flex w-full flex-wrap items-end justify-between gap-2 border-t border-stone-100 pt-4">
                  <span class="text-2xl font-black tracking-tight text-emerald-950">{{ formatCurrency(product.price) }}</span>
                  <span class="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700"><span class="h-2 w-2 rounded-full bg-emerald-500" aria-hidden="true" />In stock</span>
                </span>
              </button>
            </article>
          </div>
          <p v-else class="mt-5 rounded-3xl border border-dashed border-stone-300 bg-white px-5 py-14 text-center text-sm text-slate-600">No products match your search. Try another word or category.</p>
        </template>
        <p v-else-if="!isLoading && !errorMessage" class="mt-7 rounded-3xl border border-dashed border-stone-300 bg-white px-5 py-14 text-center text-sm text-slate-600">There are no products available right now. Please check back later.</p>
        <p v-else-if="isLoading" class="mt-7 rounded-3xl bg-white px-5 py-14 text-center text-sm text-slate-600" role="status">Loading the menu…</p>
      </section>

      <footer class="rounded-[2rem] bg-emerald-900 px-6 py-8 text-center text-white sm:px-10 sm:py-10">
        <p class="text-xs font-bold uppercase tracking-[0.2em] text-lime-300">Found something you like?</p>
        <p class="mt-2 text-xl font-bold sm:text-2xl">Send {{ VIBER_CONTACT }} your product names and quantities on Viber.</p>
        <p class="mt-3 select-all text-2xl font-black tracking-tight text-lime-300">{{ VIBER_NUMBER }}</p>
        <p class="mt-4 text-xs leading-5 text-emerald-100/80">Prices and availability can change. Please wait for Daniel B. to confirm your order.</p>
      </footer>
    </main>

    <Teleport to="body">
      <div v-if="selectedProduct" class="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/70 sm:items-center sm:p-5" @click.self="closeProduct" @keydown="dialogKeydown">
        <section ref="dialogPanel" role="dialog" aria-modal="true" aria-labelledby="product-detail-title" aria-describedby="product-detail-description" class="max-h-[92dvh] w-full max-w-2xl overflow-y-auto rounded-t-[2rem] bg-white shadow-2xl sm:rounded-[2rem]">
          <div class="flex items-start justify-between gap-4 px-5 pb-4 pt-5 sm:px-7 sm:pt-7">
            <div class="min-w-0">
              <span class="inline-flex rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide" :class="categoryAppearance(selectedProduct.category).badge">{{ selectedProduct.category }}</span>
              <h2 id="product-detail-title" class="mt-3 text-2xl font-black leading-tight text-slate-950 sm:text-3xl">{{ selectedProduct.name }}</h2>
            </div>
            <button ref="closeButton" type="button" class="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-stone-200 bg-white text-2xl text-slate-700 hover:bg-stone-100 focus:outline-none focus:ring-2 focus:ring-emerald-600" aria-label="Close product details" @click="closeProduct">&times;</button>
          </div>
          <div class="relative h-[min(50dvh,30rem)] min-h-64 overflow-hidden bg-stone-100" :class="selectedProduct.images?.length ? '' : categoryAppearance(selectedProduct.category).background">
            <ProductPhotoCarousel :key="`${selectedProduct.category}:${selectedProduct.name}`" :images="selectedProduct.images ?? []" :product-name="selectedProduct.name" :fallback-icon="selectedProduct.icon || categoryAppearance(selectedProduct.category).symbol" image-fit="contain" />
          </div>
          <div class="px-5 pb-7 pt-5 sm:px-7">
            <div class="flex flex-wrap items-center justify-between gap-3">
              <span class="text-3xl font-black tracking-tight text-emerald-950">{{ formatCurrency(selectedProduct.price) }}</span>
              <span class="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-2 text-sm font-bold text-emerald-800"><span class="h-2 w-2 rounded-full bg-emerald-500" aria-hidden="true" />In stock</span>
            </div>
            <p id="product-detail-description" class="mt-5 text-sm leading-6 text-slate-600">Interested in this product? Send {{ VIBER_CONTACT }} the name and quantity you want. Please wait for confirmation before paying.</p>
            <div class="mt-5 flex flex-col gap-3 rounded-2xl bg-violet-50 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p class="text-xs font-bold uppercase tracking-wider text-violet-700">Order on Viber</p>
                <p class="mt-1 select-all text-lg font-black text-slate-950">{{ VIBER_NUMBER }}</p>
              </div>
              <button type="button" class="rounded-xl bg-violet-700 px-4 py-3 text-sm font-bold text-white hover:bg-violet-800 focus:outline-none focus:ring-2 focus:ring-violet-500" @click="copyViberNumber">{{ copyStatus === 'copied' ? 'Number copied' : 'Copy number' }}</button>
            </div>
            <p v-if="copyStatus === 'error'" class="mt-3 text-xs text-rose-700" role="status">Couldn’t copy automatically. Please select the number above.</p>
          </div>
        </section>
      </div>
    </Teleport>
  </div>
</template>

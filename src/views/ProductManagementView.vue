<script setup>
import { computed, nextTick, onMounted, ref, watch } from "vue";
import { useProductsStore } from "../stores/products";
import { useAuthStore } from "../stores/auth";
import { useTaxStore } from "../stores/taxes";
import { useCurrency } from "../composables/useFormatters";
import { formatTaxRate } from "../constants/taxes";
import AppNavbar from "../components/AppNavbar.vue";

const productsStore = useProductsStore();
const authStore = useAuthStore();
const taxStore = useTaxStore();
const { formatCurrency } = useCurrency();

const searchTerm = ref("");
const notice = ref(null);
const deleteNotice = ref(null);
const taxNotice = ref(null);
const disposalNotice = ref(null);
const disposalProduct = ref(null);
const disposalQuantity = ref("");
const disposalExpiryDate = ref("");
const disposalNote = ref("");
const disposalKey = ref(crypto.randomUUID());
const isDisposing = ref(false);
const disposalQuantityInput = ref(null);
const taxRateInputs = ref({});

const showAddForm = ref(false);
const editingProductId = ref(null);

const formName = ref("");
const formCategory = ref("");
const formSku = ref("");
const formPrice = ref("");
const formStock = ref("");
const formLowStockThreshold = ref("");

const filteredProducts = computed(() => {
  const normalized = searchTerm.value.trim().toLowerCase();
  if (!normalized) return productsStore.products;

  return productsStore.products.filter(
    (p) =>
      p.name.toLowerCase().includes(normalized) ||
      p.category.toLowerCase().includes(normalized) ||
      p.id.toLowerCase().includes(normalized) ||
      p.sku?.toLowerCase().includes(normalized)
  );
});
const pendingRemovalIds = computed(() => new Set(productsStore.deletionRequests.map((request) => request.productId)));

onMounted(async () => {
  const [requests, disposals] = await Promise.all([productsStore.loadDeletionRequests(), productsStore.loadStockDisposals()]);
  if (!requests.ok) notice.value = requests;
  else if (!disposals.ok) notice.value = disposals;
});

watch(
  () => productsStore.categories,
  (categories) => {
    taxRateInputs.value = categories.reduce((acc, category) => {
      acc[category] = taxStore.getTaxRate(category);
      return acc;
    }, {});
  },
  { immediate: true },
);

function resetForm() {
  formName.value = "";
  formCategory.value = "";
  formSku.value = "";
  formPrice.value = "";
  formStock.value = "";
  formLowStockThreshold.value = "";
  showAddForm.value = false;
  editingProductId.value = null;
}

function openAddForm() {
  resetForm();
  showAddForm.value = true;
}

function openEditForm(product) {
  formName.value = product.name;
  formCategory.value = product.category;
  formSku.value = product.sku || "";
  formPrice.value = String(product.price);
  formStock.value = String(product.stock || 0);
  formLowStockThreshold.value = String(product.lowStockThreshold || 0);
  editingProductId.value = product.id;
  showAddForm.value = false;
}

async function submitAdd() {
  const result = await productsStore.addProduct({
    name: formName.value,
    category: formCategory.value,
    sku: formSku.value,
    price: formPrice.value,
    stock: formStock.value,
    lowStockThreshold: formLowStockThreshold.value,
  });
  notice.value = result;
  if (result.ok) resetForm();
}

async function submitEdit() {
  const result = await productsStore.updateProduct(editingProductId.value, {
    name: formName.value,
    category: formCategory.value,
    sku: formSku.value,
    price: formPrice.value,
    stock: formStock.value,
    lowStockThreshold: formLowStockThreshold.value,
  });
  notice.value = result;
  if (result.ok) resetForm();
}

function closeDisposal() {
  disposalProduct.value = null;
  disposalQuantity.value = "";
  disposalExpiryDate.value = "";
  disposalNote.value = "";
}

async function openDisposal(product) {
  closeDisposal();
  disposalProduct.value = product;
  disposalNotice.value = null;
  await nextTick();
  disposalQuantityInput.value?.focus();
}

async function submitDisposal() {
  if (!disposalProduct.value || isDisposing.value) return;
  isDisposing.value = true;
  try {
    const result = await productsStore.disposeExpiredStock(disposalProduct.value.id, {
      disposalKey: disposalKey.value,
      quantity: disposalQuantity.value,
      expiryDate: disposalExpiryDate.value,
      note: disposalNote.value,
    });
    disposalNotice.value = result;
    if (result.ok) {
      closeDisposal();
      disposalKey.value = crypto.randomUUID();
    }
  } finally {
    isDisposing.value = false;
  }
}

async function confirmDelete(product) {
  const action = authStore.isAdmin ? "remove from the active catalog" : "request admin approval to remove";
  const confirmed = window.confirm(`Do you want to ${action} "${product.name}"? Past sales and refunds will be kept.`);
  if (!confirmed) return;

  notice.value = null;
  const result = authStore.isAdmin
    ? await productsStore.deleteProduct(product.id)
    : await productsStore.requestProductRemoval(product.id);
  deleteNotice.value = result;
}

async function reviewRemoval(request, decision) {
  if (decision === "approve" && !window.confirm(`Remove "${request.productName}" from the active catalog?`)) return;
  deleteNotice.value = await productsStore.reviewDeletionRequest(request.id, decision);
}

async function confirmClear() {
  const confirmed = window.confirm("Remove every active product from the catalog? Past sales and refunds will be kept.");
  if (!confirmed) return;

  const result = await productsStore.clearCatalog();
  notice.value = result;
  if (result.ok) resetForm();
}

async function updateCategoryTax(category) {
  const result = await taxStore.setTaxRate(category, taxRateInputs.value[category]);
  taxNotice.value = result;
}

async function resetTaxRates() {
  const confirmed = window.confirm("Reset category tax rates to default values?");
  if (!confirmed) return;

  const result = await taxStore.resetTaxRates();
  taxNotice.value = result;
  taxRateInputs.value = productsStore.categories.reduce((acc, category) => {
    acc[category] = taxStore.getTaxRate(category);
    return acc;
  }, {});
}
</script>

<template>
  <div class="min-h-screen bg-slate-50">
    <AppNavbar show-back />

    <main class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div class="grid grid-cols-1 gap-4 sm:grid-cols-4 mb-6">
        <div class="rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm">
          <p class="text-sm font-medium text-slate-500">Total Products</p>
          <p class="mt-1 text-2xl font-bold text-slate-900">{{ productsStore.totalProducts }}</p>
        </div>
        <div class="rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm">
          <p class="text-sm font-medium text-slate-500">Categories</p>
          <p class="mt-1 text-2xl font-bold text-blue-600">{{ productsStore.categories.length }}</p>
        </div>
        <div class="rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm">
          <p class="text-sm font-medium text-slate-500">Low Stock Alerts</p>
          <p class="mt-1 text-2xl font-bold text-amber-600">{{ productsStore.lowStockAlerts.length }}</p>
        </div>
        <div class="rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm">
          <p class="text-sm font-medium text-slate-500">Out of Stock</p>
          <p class="mt-1 text-2xl font-bold text-red-600">{{ productsStore.outOfStockProducts.length }}</p>
        </div>
        <div class="rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm">
          <p class="text-sm font-medium text-slate-500">Quick Actions</p>
          <div class="mt-1 flex flex-wrap gap-2">
            <button class="rounded-2xl bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-500 transition-colors" @click="openAddForm">+ Add Product</button>
            <button v-if="authStore.isAdmin && productsStore.totalProducts > 0" class="rounded-2xl border border-rose-200 px-3 py-1.5 text-sm font-medium text-rose-600 hover:bg-rose-50 transition-colors" @click="confirmClear">Clear Catalog</button>
          </div>
        </div>
      </div>

      <div v-if="notice" class="mb-4 rounded-2xl border px-4 py-3 text-sm flex items-center justify-between" :class="notice.ok ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-rose-200 bg-rose-50 text-rose-700'">
        <span>{{ notice.message }}</span>
        <button class="ml-3 font-medium hover:underline" @click="notice = null">Dismiss</button>
      </div>

      <div v-if="productsStore.lowStockAlerts.length > 0" class="mb-6 rounded-[1.75rem] border border-amber-200 bg-amber-50 p-5 shadow-sm">
        <h3 class="text-lg font-semibold text-amber-800 mb-3">Low Stock Alerts</h3>
        <div class="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          <div v-for="product in productsStore.lowStockAlerts" :key="product.id" class="flex items-center justify-between rounded-lg bg-white p-3 shadow-sm">
            <div>
              <p class="font-medium text-slate-800">{{ product.name }}</p>
              <p class="text-sm text-slate-500">Stock: {{ product.stock }} | Threshold: {{ product.lowStockThreshold }}</p>
            </div>
            <button class="rounded-full border border-amber-300 px-3 py-1 text-xs font-medium text-amber-700 hover:bg-amber-100 transition-colors" @click="openEditForm(product)">Update Stock</button>
          </div>
        </div>
      </div>

      <div v-if="productsStore.outOfStockProducts.length > 0" class="mb-6 rounded-[1.75rem] border border-red-200 bg-red-50 p-5 shadow-sm">
        <h3 class="text-lg font-semibold text-red-800 mb-3">Out of Stock</h3>
        <div class="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          <div v-for="product in productsStore.outOfStockProducts" :key="product.id" class="flex items-center justify-between rounded-lg bg-white p-3 shadow-sm">
            <div>
              <p class="font-medium text-slate-800">{{ product.name }}</p>
              <p class="text-sm text-slate-500">Needs restocking</p>
            </div>
            <button class="rounded-full border border-red-300 px-3 py-1 text-xs font-medium text-red-700 hover:bg-red-100 transition-colors" @click="openEditForm(product)">Restock</button>
          </div>
        </div>
      </div>

      <div class="mb-6 rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm">
        <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 class="text-lg font-semibold text-slate-800">Category Tax Rates</h2>
            <p class="mt-1 text-sm text-slate-500">Adjust tax rate by product category. Changes are saved in PostgreSQL.</p>
          </div>
          <button class="rounded-2xl border border-slate-300 px-4 py-3 text-sm font-medium text-slate-600 hover:bg-slate-50 transition" @click="resetTaxRates">Reset Tax Rates</button>
        </div>

        <div v-if="taxNotice" class="mt-4 rounded-2xl border px-4 py-3 text-sm flex items-center justify-between" :class="taxNotice.ok ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-rose-200 bg-rose-50 text-rose-700'">
          <span>{{ taxNotice.message }}</span>
          <button class="ml-3 font-medium hover:underline" @click="taxNotice = null">Dismiss</button>
        </div>

        <div class="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div v-for="category in productsStore.categories" :key="category" class="rounded-3xl border border-slate-200 bg-slate-50 p-4">
            <div class="mb-3 flex items-center justify-between gap-3">
              <div>
                <p class="text-sm font-semibold text-slate-800">{{ category }}</p>
                <p class="text-xs text-slate-500">Current category rate</p>
              </div>
              <span class="inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-700">{{ formatTaxRate(taxStore.getTaxRate(category)) }}</span>
            </div>
            <div class="space-y-3">
              <label class="text-xs font-medium text-slate-700">Set rate</label>
              <input
                type="number"
                min="0"
                max="1"
                step="0.01"
                v-model.number="taxRateInputs[category]"
                class="w-full rounded-2xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
              />
              <button class="w-full rounded-2xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 transition" @click="updateCategoryTax(category)">Save</button>
            </div>
          </div>
        </div>
      </div>

      <div v-if="showAddForm || editingProductId" class="mb-6 rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm">
        <h2 class="text-lg font-semibold text-slate-800 mb-4">{{ editingProductId ? 'Edit Product' : 'Add New Product' }}</h2>
        <form class="grid grid-cols-1 gap-4 sm:grid-cols-5" @submit.prevent="editingProductId ? submitEdit() : submitAdd()">
          <div>
            <label for="productName" class="mb-1 block text-sm font-medium text-slate-700">Name</label>
            <input id="productName" v-model="formName" type="text" placeholder="e.g. Iced Tea" class="w-full rounded-2xl border border-slate-300 px-3 py-2 text-sm text-slate-700 placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100" />
          </div>
          <div>
            <label for="productCategory" class="mb-1 block text-sm font-medium text-slate-700">Category</label>
            <input id="productCategory" v-model="formCategory" type="text" list="categoryOptions" placeholder="e.g. Drinks" class="w-full rounded-2xl border border-slate-300 px-3 py-2 text-sm text-slate-700 placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100" />
            <datalist id="categoryOptions">
              <option v-for="cat in productsStore.categories" :key="cat" :value="cat" />
            </datalist>
          </div>
          <div>
            <label for="productSku" class="mb-1 block text-sm font-medium text-slate-700">Barcode / SKU</label>
            <input id="productSku" v-model="formSku" type="text" placeholder="e.g. 10010001" class="w-full rounded-2xl border border-slate-300 px-3 py-2 text-sm text-slate-700 placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100" />
          </div>
          <div>
            <label for="productPrice" class="mb-1 block text-sm font-medium text-slate-700">Price (₱)</label>
            <input id="productPrice" v-model="formPrice" type="number" step="0.01" min="0" required placeholder="0.00" class="w-full rounded-2xl border border-slate-300 px-3 py-2 text-sm text-slate-700 placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100" />
          </div>
          <div>
            <label for="productStock" class="mb-1 block text-sm font-medium text-slate-700">Stock</label>
            <input id="productStock" v-model="formStock" type="number" min="0" step="1" required placeholder="0" class="w-full rounded-2xl border border-slate-300 px-3 py-2 text-sm text-slate-700 placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100" />
          </div>
          <div>
            <label for="productThreshold" class="mb-1 block text-sm font-medium text-slate-700">Low Stock Alert</label>
            <input id="productThreshold" v-model="formLowStockThreshold" type="number" min="0" step="1" required placeholder="0" class="w-full rounded-2xl border border-slate-300 px-3 py-2 text-sm text-slate-700 placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100" />
          </div>
          <div class="flex items-end gap-2 sm:col-span-5">
            <button type="submit" class="rounded-2xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500 transition-colors">{{ editingProductId ? 'Save Changes' : 'Add Product' }}</button>
            <button type="button" class="rounded-2xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors" @click="resetForm">Cancel</button>
          </div>
        </form>
      </div>

      <div class="mb-6 rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm">
        <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 class="text-lg font-semibold text-slate-800">Product Catalog</h2>
            <p class="mt-1 text-sm text-slate-500">Filter products by name, category, ID, or SKU.</p>
          </div>
          <input v-model="searchTerm" type="text" placeholder="Search name, category, ID, or SKU" class="w-full rounded-2xl border border-slate-300 px-3 py-2 text-sm text-slate-700 placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100 sm:max-w-xs" />
        </div>
      </div>

      <div v-if="deleteNotice" role="status" aria-live="polite" class="mb-4 flex items-start justify-between gap-3 rounded-xl border px-4 py-3 text-sm" :class="deleteNotice.ok ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-rose-200 bg-rose-50 text-rose-700'">
        <span>{{ deleteNotice.message }}</span>
        <button type="button" class="font-semibold hover:underline" @click="deleteNotice = null">Dismiss</button>
      </div>

      <div v-if="disposalNotice" role="status" aria-live="polite" class="mb-4 flex items-start justify-between gap-3 rounded-xl border px-4 py-3 text-sm" :class="disposalNotice.ok ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-rose-200 bg-rose-50 text-rose-700'">
        <span>{{ disposalNotice.message }}</span>
        <button type="button" class="font-semibold hover:underline" @click="disposalNotice = null">Dismiss</button>
      </div>

      <section v-if="disposalProduct" aria-labelledby="disposal-heading" class="mb-6 rounded-[1.75rem] border border-amber-300 bg-amber-50 p-5 shadow-sm">
        <h2 id="disposal-heading" class="text-lg font-semibold text-amber-950">Dispose expired stock: {{ disposalProduct.name }}</h2>
        <p class="mt-1 text-sm text-amber-900">{{ disposalProduct.stock }} units currently available. Disposal reduces stock without creating a sale. If none remain, this product disappears from the customer menu.</p>
        <form class="mt-4 grid gap-4 sm:grid-cols-2" @submit.prevent="submitDisposal">
          <div>
            <label for="disposal-quantity" class="mb-1 block text-sm font-medium text-slate-800">Units to dispose *</label>
            <input id="disposal-quantity" ref="disposalQuantityInput" v-model="disposalQuantity" type="number" min="1" :max="disposalProduct.stock" step="1" required class="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-slate-950 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-100" />
          </div>
          <div>
            <label for="disposal-expiry" class="mb-1 block text-sm font-medium text-slate-800">Expiry date on package (optional)</label>
            <input id="disposal-expiry" v-model="disposalExpiryDate" type="date" class="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-slate-950 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-100" />
          </div>
          <div class="sm:col-span-2">
            <label for="disposal-note" class="mb-1 block text-sm font-medium text-slate-800">Note (optional)</label>
            <input id="disposal-note" v-model="disposalNote" type="text" maxlength="200" class="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-slate-950 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-100" placeholder="For example: found during shelf check" />
          </div>
          <div class="flex flex-wrap gap-2 sm:col-span-2">
            <button type="submit" :disabled="isDisposing" class="rounded-xl bg-amber-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-amber-800 disabled:opacity-50">{{ isDisposing ? 'Recording...' : 'Record disposal' }}</button>
            <button type="button" :disabled="isDisposing" class="rounded-xl border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50" @click="closeDisposal">Cancel</button>
          </div>
        </form>
      </section>

      <section v-if="productsStore.deletionRequests.length > 0" class="mb-6 rounded-[1.75rem] border border-amber-200 bg-amber-50 p-5 shadow-sm">
        <h2 class="text-lg font-semibold text-amber-950">{{ authStore.isAdmin ? 'Removal requests awaiting approval' : 'Your removal requests' }}</h2>
        <div class="mt-4 space-y-3">
          <div v-for="request in productsStore.deletionRequests" :key="request.id" class="flex flex-col gap-3 rounded-2xl border border-amber-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p class="font-semibold text-slate-900">{{ request.productName }}</p>
              <p class="text-xs text-slate-600">Requested by {{ request.requesterName }} · {{ new Date(request.requestedAt).toLocaleString() }}</p>
            </div>
            <div v-if="authStore.isAdmin" class="flex gap-2">
              <button type="button" class="rounded-xl bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-500" @click="reviewRemoval(request, 'approve')">Approve removal</button>
              <button type="button" class="rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50" @click="reviewRemoval(request, 'reject')">Reject</button>
            </div>
            <span v-else class="text-sm font-semibold text-amber-800">Pending admin approval</span>
          </div>
        </div>
      </section>

      <div class="rounded-[1.75rem] border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div class="border-b border-slate-200 px-5 py-4">
          <p class="text-sm text-slate-600">{{ authStore.isAdmin ? 'Removing a product hides it from the POS and customer menu. Past sales and refunds remain available.' : 'Managers can request product removal. An admin must approve before the product leaves the catalog.' }}</p>
        </div>
        <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead>
            <tr class="border-b border-slate-200 bg-slate-50">
              <th class="px-5 py-3 text-left text-xs font-medium uppercase tracking-wide text-slate-500">ID</th>
              <th class="px-5 py-3 text-left text-xs font-medium uppercase tracking-wide text-slate-500">SKU</th>
              <th class="px-5 py-3 text-left text-xs font-medium uppercase tracking-wide text-slate-500">Name</th>
              <th class="px-5 py-3 text-left text-xs font-medium uppercase tracking-wide text-slate-500">Category</th>
              <th class="px-5 py-3 text-right text-xs font-medium uppercase tracking-wide text-slate-500">Price</th>
              <th class="px-5 py-3 text-right text-xs font-medium uppercase tracking-wide text-slate-500">Stock</th>
              <th class="px-5 py-3 text-right text-xs font-medium uppercase tracking-wide text-slate-500">Actions</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-200">
            <tr v-for="product in filteredProducts" :key="product.id" class="hover:bg-slate-50 transition-colors">
              <td class="px-5 py-3 text-slate-500 font-mono text-xs">{{ product.id }}</td>
              <td class="px-5 py-3 font-mono text-xs text-slate-500">{{ product.sku || product.id }}</td>
              <td class="px-5 py-3 font-medium text-slate-800">{{ product.name }}</td>
              <td class="px-5 py-3"><span class="inline-block rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700">{{ product.category }}</span></td>
              <td class="px-5 py-3 text-right font-semibold text-blue-700">{{ formatCurrency(product.price) }}</td>
              <td class="px-5 py-3 text-right">
                <span 
                  class="inline-block px-2.5 py-0.5 text-xs font-medium rounded-full"
                  :class="{
                    'bg-red-100 text-red-700': (product.stock || 0) === 0,
                    'bg-amber-100 text-amber-700': (product.stock || 0) > 0 && (product.stock || 0) <= (product.lowStockThreshold || 0),
                    'bg-emerald-100 text-emerald-700': (product.stock || 0) > (product.lowStockThreshold || 0)
                  }"
                >
                  {{ product.stock || 0 }}
                  <span v-if="(product.stock || 0) <= (product.lowStockThreshold || 0)" class="ml-1">!</span>
                </span>
              </td>
              <td class="px-5 py-3 text-right">
                <div class="flex items-center justify-end gap-2">
                  <button class="rounded-full border border-slate-300 px-3 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100 transition-colors" @click="openEditForm(product)">Edit</button>
                  <button v-if="product.stock > 0" type="button" class="rounded-full border border-amber-300 px-3 py-1 text-xs font-medium text-amber-900 hover:bg-amber-50 transition-colors" @click="openDisposal(product)">Dispose expired</button>
                  <button class="rounded-full border border-rose-200 px-3 py-1 text-xs font-medium text-rose-600 hover:bg-rose-50 transition-colors disabled:cursor-not-allowed disabled:opacity-50" :disabled="!authStore.isAdmin && pendingRemovalIds.has(product.id)" @click="confirmDelete(product)">{{ authStore.isAdmin ? 'Remove' : pendingRemovalIds.has(product.id) ? 'Pending approval' : 'Request removal' }}</button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
        </div>

        <div v-if="filteredProducts.length === 0" class="py-8 text-center text-sm text-slate-500">{{ productsStore.totalProducts === 0 ? 'Your catalog is empty. Add your first product above.' : 'No products found. Try clearing the search.' }}</div>
      </div>

      <details class="mt-6 overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white shadow-sm">
        <summary class="cursor-pointer px-5 py-4 text-sm font-semibold text-slate-800 hover:bg-slate-50">Expired stock disposal history (latest 100)</summary>
        <div v-if="productsStore.disposals.length" class="overflow-x-auto border-t border-slate-200">
          <table class="w-full min-w-[650px] text-left text-sm">
            <thead class="bg-slate-50 text-xs uppercase tracking-wide text-slate-600">
              <tr><th scope="col" class="px-5 py-3">When</th><th scope="col" class="px-5 py-3">Product</th><th scope="col" class="px-5 py-3 text-right">Units</th><th scope="col" class="px-5 py-3">Expiry date</th><th scope="col" class="px-5 py-3">Recorded by</th><th scope="col" class="px-5 py-3">Note</th></tr>
            </thead>
            <tbody class="divide-y divide-slate-200">
              <tr v-for="disposal in productsStore.disposals" :key="disposal.id">
                <td class="px-5 py-3 text-slate-700">{{ new Date(disposal.disposedAt).toLocaleString() }}</td>
                <td class="px-5 py-3 font-medium text-slate-900">{{ disposal.productName }}</td>
                <td class="px-5 py-3 text-right font-semibold text-amber-900">{{ disposal.quantity }}</td>
                <td class="px-5 py-3 text-slate-700">{{ disposal.expiryDate || '—' }}</td>
                <td class="px-5 py-3 text-slate-700">{{ disposal.disposedBy }}</td>
                <td class="px-5 py-3 text-slate-700">{{ disposal.note || '—' }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p v-else class="border-t border-slate-200 px-5 py-6 text-sm text-slate-600">No expired stock has been disposed yet.</p>
      </details>
    </main>
  </div>
</template>

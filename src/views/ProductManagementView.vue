<script setup>
import { ref, computed } from "vue";
import { useProductsStore } from "../stores/products";
import { useCurrency } from "../composables/useFormatters";
import AppNavbar from "../components/AppNavbar.vue";

const productsStore = useProductsStore();
const { formatCurrency } = useCurrency();

const searchTerm = ref("");
const notice = ref(null);

const showAddForm = ref(false);
const editingProductId = ref(null);

const formName = ref("");
const formCategory = ref("");
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
      p.id.toLowerCase().includes(normalized)
  );
});

function resetForm() {
  formName.value = "";
  formCategory.value = "";
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
  formPrice.value = String(product.price);
  formStock.value = String(product.stock || 0);
  formLowStockThreshold.value = String(product.lowStockThreshold || 0);
  editingProductId.value = product.id;
  showAddForm.value = false;
}

function submitAdd() {
  const result = productsStore.addProduct({
    name: formName.value,
    category: formCategory.value,
    price: formPrice.value,
    stock: formStock.value,
    lowStockThreshold: formLowStockThreshold.value,
  });
  notice.value = result;
  if (result.ok) resetForm();
}

function submitEdit() {
  const result = productsStore.updateProduct(editingProductId.value, {
    name: formName.value,
    category: formCategory.value,
    price: formPrice.value,
    stock: formStock.value,
    lowStockThreshold: formLowStockThreshold.value,
  });
  notice.value = result;
  if (result.ok) resetForm();
}

function confirmDelete(product) {
  const confirmed = window.confirm(`Are you sure you want to delete "${product.name}"?`);
  if (!confirmed) return;

  const result = productsStore.deleteProduct(product.id);
  notice.value = result;
}

function confirmReset() {
  const confirmed = window.confirm("Reset the entire catalog to defaults? This cannot be undone.");
  if (!confirmed) return;

  const result = productsStore.resetToDefaults();
  notice.value = result;
  resetForm();
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
            <button class="rounded-2xl border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors" @click="confirmReset">Reset Catalog</button>
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
            <label for="productPrice" class="mb-1 block text-sm font-medium text-slate-700">Price ($)</label>
            <input id="productPrice" v-model="formPrice" type="number" step="0.01" min="0" placeholder="0.00" class="w-full rounded-2xl border border-slate-300 px-3 py-2 text-sm text-slate-700 placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100" />
          </div>
          <div>
            <label for="productStock" class="mb-1 block text-sm font-medium text-slate-700">Stock</label>
            <input id="productStock" v-model="formStock" type="number" min="0" placeholder="0" class="w-full rounded-2xl border border-slate-300 px-3 py-2 text-sm text-slate-700 placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100" />
          </div>
          <div>
            <label for="productThreshold" class="mb-1 block text-sm font-medium text-slate-700">Low Stock Alert</label>
            <input id="productThreshold" v-model="formLowStockThreshold" type="number" min="0" placeholder="0" class="w-full rounded-2xl border border-slate-300 px-3 py-2 text-sm text-slate-700 placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100" />
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
            <p class="mt-1 text-sm text-slate-500">Filter products by name, category, or ID.</p>
          </div>
          <input v-model="searchTerm" type="text" placeholder="Search products..." class="w-full rounded-2xl border border-slate-300 px-3 py-2 text-sm text-slate-700 placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100 sm:max-w-xs" />
        </div>
      </div>

      <div class="rounded-[1.75rem] border border-slate-200 bg-white shadow-sm overflow-hidden">
        <table class="w-full text-sm">
          <thead>
            <tr class="border-b border-slate-200 bg-slate-50">
              <th class="px-5 py-3 text-left text-xs font-medium uppercase tracking-wide text-slate-500">ID</th>
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
                  <button class="rounded-full border border-rose-200 px-3 py-1 text-xs font-medium text-rose-600 hover:bg-rose-50 transition-colors" @click="confirmDelete(product)">Delete</button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>

        <div v-if="filteredProducts.length === 0" class="py-8 text-center text-sm text-slate-500">No products found. Try clearing the search or add a new product.</div>
      </div>
    </main>
  </div>
</template>

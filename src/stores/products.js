import { computed, ref } from "vue";
import { defineStore } from "pinia";
import { api } from "../lib/api";

export const useProductsStore = defineStore("products", () => {
  const products = ref([]);
  const deletionRequests = ref([]);
  const disposals = ref([]);
  const categories = computed(() => [...new Set(products.value.map((product) => product.category))].sort());
  const totalProducts = computed(() => products.value.length);
  const lowStockAlerts = computed(() => products.value.filter((product) => product.stock <= product.lowStockThreshold));
  const outOfStockProducts = computed(() => products.value.filter((product) => product.stock === 0));

  async function mutate(path, method, body) {
    try {
      const result = await api(path, { method, body });
      if (Array.isArray(result.products)) products.value = result.products;
      if (Array.isArray(result.requests)) deletionRequests.value = result.requests;
      if (Array.isArray(result.disposals)) disposals.value = result.disposals;
      return result;
    } catch (error) {
      return { ok: false, message: error.message };
    }
  }

  function addProduct(input) { return mutate("/products", "POST", input); }
  function updateProduct(id, input) { return mutate(`/products/${encodeURIComponent(id)}`, "PUT", input); }
  function deleteProduct(id) { return mutate(`/products/${encodeURIComponent(id)}`, "DELETE"); }
  function clearCatalog() { return mutate("/products", "DELETE"); }
  function disposeExpiredStock(id, input) { return mutate(`/products/${encodeURIComponent(id)}/disposals`, "POST", input); }
  async function loadStockDisposals() {
    try {
      disposals.value = await api("/stock-disposals");
      return { ok: true };
    } catch (error) { return { ok: false, message: error.message }; }
  }
  async function loadDeletionRequests() {
    try {
      deletionRequests.value = await api("/product-delete-requests");
      return { ok: true };
    } catch (error) { return { ok: false, message: error.message }; }
  }
  function requestProductRemoval(id) { return mutate(`/products/${encodeURIComponent(id)}/delete-request`, "POST"); }
  function reviewDeletionRequest(id, decision) { return mutate(`/product-delete-requests/${encodeURIComponent(id)}/decision`, "POST", { decision }); }

  function getProductByBarcode(code) {
    const normalized = String(code ?? "").trim().toLowerCase();
    return products.value.find((product) => product.id.toLowerCase() === normalized || product.sku?.toLowerCase() === normalized) ?? null;
  }
  function checkStockAvailability(id, quantity) { return (products.value.find((product) => product.id === id)?.stock ?? 0) >= quantity; }
  function getProductStock(id) { return products.value.find((product) => product.id === id)?.stock ?? 0; }

  return { products, deletionRequests, disposals, categories, totalProducts, lowStockAlerts, outOfStockProducts, addProduct, updateProduct, deleteProduct, clearCatalog, disposeExpiredStock, loadStockDisposals, loadDeletionRequests, requestProductRemoval, reviewDeletionRequest, getProductByBarcode, checkStockAvailability, getProductStock };
});

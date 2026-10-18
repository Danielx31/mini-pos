import { computed, ref } from "vue";
import { defineStore } from "pinia";
import { api } from "../lib/api";

export const useProductsStore = defineStore("products", () => {
  const products = ref([]);
  const categories = computed(() => [...new Set(products.value.map((product) => product.category))].sort());
  const totalProducts = computed(() => products.value.length);
  const lowStockAlerts = computed(() => products.value.filter((product) => product.stock <= product.lowStockThreshold));
  const outOfStockProducts = computed(() => products.value.filter((product) => product.stock === 0));

  async function mutate(path, method, body) {
    try {
      const result = await api(path, { method, body });
      products.value = result.products;
      return result;
    } catch (error) {
      return { ok: false, message: error.message };
    }
  }

  function addProduct(input) { return mutate("/products", "POST", input); }
  function updateProduct(id, input) { return mutate(`/products/${encodeURIComponent(id)}`, "PUT", input); }
  function deleteProduct(id) { return mutate(`/products/${encodeURIComponent(id)}`, "DELETE"); }
  function clearCatalog() { return mutate("/products", "DELETE"); }

  function getProductByBarcode(code) {
    const normalized = String(code ?? "").trim().toLowerCase();
    return products.value.find((product) => product.id.toLowerCase() === normalized || product.sku?.toLowerCase() === normalized) ?? null;
  }
  function checkStockAvailability(id, quantity) { return (products.value.find((product) => product.id === id)?.stock ?? 0) >= quantity; }
  function getProductStock(id) { return products.value.find((product) => product.id === id)?.stock ?? 0; }

  return { products, categories, totalProducts, lowStockAlerts, outOfStockProducts, addProduct, updateProduct, deleteProduct, clearCatalog, getProductByBarcode, checkStockAvailability, getProductStock };
});

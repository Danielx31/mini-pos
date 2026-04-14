import { computed, ref } from "vue";
import { defineStore } from "pinia";
import { DEFAULT_PRODUCTS } from "../data/products";

const STORAGE_KEY = "mini_pos_products";

export const useProductsStore = defineStore("products", () => {
  const products = ref(loadProductsFromStorage());

  const categories = computed(() => {
    const unique = new Set(products.value.map((p) => p.category));
    return [...unique].sort();
  });

  const totalProducts = computed(() => products.value.length);

  const lowStockAlerts = computed(() => {
    return products.value.filter((p) => (p.stock || 0) <= (p.lowStockThreshold || 0));
  });

  const outOfStockProducts = computed(() => {
    return products.value.filter((p) => (p.stock || 0) === 0);
  });

  function loadProductsFromStorage() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        // Ensure all products have stock, lowStockThreshold, and SKU properties
        return parsed.map(product => ({
          ...product,
          sku: product.sku?.trim() || product.id,
          stock: product.stock ?? 0,
          lowStockThreshold: product.lowStockThreshold ?? 0,
        }));
      }
      return [...DEFAULT_PRODUCTS];
    } catch {
      return [...DEFAULT_PRODUCTS];
    }
  }

  function saveProductsToStorage() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(products.value));
  }

  function generateId() {
    const maxNum = products.value.reduce((max, p) => {
      const num = parseInt(p.id.replace("p-", ""), 10);
      return Number.isFinite(num) && num > max ? num : max;
    }, 0);
    return `p-${String(maxNum + 1).padStart(3, "0")}`;
  }

  function addProduct({ name, category, price, stock, lowStockThreshold, sku }) {
    const trimmedName = name.trim();
    const trimmedCategory = category.trim();
    const trimmedSku = sku?.trim();
    const parsedPrice = parseFloat(price);
    const parsedStock = parseInt(stock);
    const parsedThreshold = parseInt(lowStockThreshold);

    if (!trimmedName || !trimmedCategory || !Number.isFinite(parsedPrice) || parsedPrice < 0) {
      return { ok: false, message: "Please fill in all fields with valid values." };
    }

    if (!Number.isFinite(parsedStock) || parsedStock < 0) {
      return { ok: false, message: "Stock quantity must be a valid non-negative number." };
    }

    if (!Number.isFinite(parsedThreshold) || parsedThreshold < 0) {
      return { ok: false, message: "Low stock threshold must be a valid non-negative number." };
    }

    const duplicateName = products.value.some(
      (p) => p.name.toLowerCase() === trimmedName.toLowerCase(),
    );
    if (duplicateName) {
      return { ok: false, message: `A product named "${trimmedName}" already exists.` };
    }

    if (trimmedSku) {
      const duplicateSku = products.value.some(
        (p) => p.sku?.toLowerCase() === trimmedSku.toLowerCase(),
      );
      if (duplicateSku) {
        return { ok: false, message: `The SKU "${trimmedSku}" is already assigned to another product.` };
      }
    }

    const newProduct = {
      id: generateId(),
      sku: trimmedSku || undefined,
      name: trimmedName,
      category: trimmedCategory,
      price: Math.round(parsedPrice * 100) / 100,
      stock: parsedStock,
      lowStockThreshold: parsedThreshold,
    };

    products.value.push(newProduct);
    saveProductsToStorage();
    return { ok: true, message: `"${trimmedName}" added successfully.` };
  }

  function updateProduct(id, { name, category, price, stock, lowStockThreshold, sku }) {
    const trimmedName = name.trim();
    const trimmedCategory = category.trim();
    const trimmedSku = sku?.trim();
    const parsedPrice = parseFloat(price);
    const parsedStock = parseInt(stock);
    const parsedThreshold = parseInt(lowStockThreshold);

    if (!trimmedName || !trimmedCategory || !Number.isFinite(parsedPrice) || parsedPrice < 0) {
      return { ok: false, message: "Please fill in all fields with valid values." };
    }

    if (!Number.isFinite(parsedStock) || parsedStock < 0) {
      return { ok: false, message: "Stock quantity must be a valid non-negative number." };
    }

    if (!Number.isFinite(parsedThreshold) || parsedThreshold < 0) {
      return { ok: false, message: "Low stock threshold must be a valid non-negative number." };
    }

    const duplicateName = products.value.some(
      (p) => p.id !== id && p.name.toLowerCase() === trimmedName.toLowerCase(),
    );
    if (duplicateName) {
      return { ok: false, message: `A product named "${trimmedName}" already exists.` };
    }

    if (trimmedSku) {
      const duplicateSku = products.value.some(
        (p) => p.id !== id && p.sku?.toLowerCase() === trimmedSku.toLowerCase(),
      );
      if (duplicateSku) {
        return { ok: false, message: `The SKU "${trimmedSku}" is already assigned to another product.` };
      }
    }

    const product = products.value.find((p) => p.id === id);
    if (!product) {
      return { ok: false, message: "Product not found." };
    }

    product.name = trimmedName;
    product.category = trimmedCategory;
    product.sku = trimmedSku || undefined;
    product.price = Math.round(parsedPrice * 100) / 100;
    product.stock = parsedStock;
    product.lowStockThreshold = parsedThreshold;
    saveProductsToStorage();
    return { ok: true, message: `"${trimmedName}" updated successfully.` };
  }

  function deleteProduct(id) {
    const product = products.value.find((p) => p.id === id);
    if (!product) {
      return { ok: false, message: "Product not found." };
    }

    products.value = products.value.filter((p) => p.id !== id);
    saveProductsToStorage();
    return { ok: true, message: `"${product.name}" deleted.` };
  }

  function getProductByBarcode(code) {
    const normalizedCode = String(code || "").trim().toLowerCase();
    if (!normalizedCode) {
      return null;
    }

    return products.value.find((product) => {
      return (
        product.id.toLowerCase() === normalizedCode ||
        (product.sku && product.sku.toLowerCase() === normalizedCode)
      );
    }) || null;
  }

  function decrementStock(productId, quantity) {
    const product = products.value.find((p) => p.id === productId);
    if (!product) {
      return { ok: false, message: "Product not found." };
    }

    if ((product.stock || 0) < quantity) {
      return { ok: false, message: `Insufficient stock for "${product.name}". Available: ${product.stock || 0}` };
    }

    product.stock = (product.stock || 0) - quantity;
    saveProductsToStorage();
    return { ok: true, message: `Stock decremented for "${product.name}".` };
  }

  function checkStockAvailability(productId, quantity) {
    const product = products.value.find((p) => p.id === productId);
    if (!product) return false;
    return (product.stock || 0) >= quantity;
  }

  function getProductStock(productId) {
    const product = products.value.find((p) => p.id === productId);
    return product ? (product.stock || 0) : 0;
  }

  function resetToDefaults() {
    products.value = [...DEFAULT_PRODUCTS];
    saveProductsToStorage();
    return { ok: true, message: "Product catalog reset to defaults." };
  }

  return {
    products,
    categories,
    totalProducts,
    lowStockAlerts,
    outOfStockProducts,
    addProduct,
    updateProduct,
    deleteProduct,
    resetToDefaults,
    decrementStock,
    checkStockAvailability,
    getProductStock,
    getProductByBarcode,
  };
});

import { computed, ref } from "vue";
import { defineStore } from "pinia";

const STORAGE_KEY = "mini_pos_products";

const DEFAULT_CATALOG = [
  { id: "p-001", name: "Bottled Water", category: "Drinks", price: 1.0 },
  { id: "p-002", name: "Sparkling Soda", category: "Drinks", price: 1.75 },
  { id: "p-003", name: "Classic Burger", category: "Food", price: 5.5 },
  { id: "p-004", name: "Chicken Sandwich", category: "Food", price: 6.25 },
  { id: "p-005", name: "French Fries", category: "Sides", price: 2.5 },
  { id: "p-006", name: "Garden Salad", category: "Sides", price: 3.75 },
  { id: "p-007", name: "Chocolate Bar", category: "Snacks", price: 1.25 },
  { id: "p-008", name: "Fresh Coffee", category: "Drinks", price: 2.25 },
];

export const useProductsStore = defineStore("products", () => {
  const products = ref(loadProductsFromStorage());

  const categories = computed(() => {
    const unique = new Set(products.value.map((p) => p.category));
    return [...unique].sort();
  });

  const totalProducts = computed(() => products.value.length);

  function loadProductsFromStorage() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : [...DEFAULT_CATALOG];
    } catch {
      return [...DEFAULT_CATALOG];
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

  function addProduct({ name, category, price }) {
    const trimmedName = name.trim();
    const trimmedCategory = category.trim();
    const parsedPrice = parseFloat(price);

    if (!trimmedName || !trimmedCategory || !Number.isFinite(parsedPrice) || parsedPrice < 0) {
      return { ok: false, message: "Please fill in all fields with valid values." };
    }

    const duplicate = products.value.some(
      (p) => p.name.toLowerCase() === trimmedName.toLowerCase(),
    );
    if (duplicate) {
      return { ok: false, message: `A product named "${trimmedName}" already exists.` };
    }

    const newProduct = {
      id: generateId(),
      name: trimmedName,
      category: trimmedCategory,
      price: Math.round(parsedPrice * 100) / 100,
    };

    products.value.push(newProduct);
    saveProductsToStorage();
    return { ok: true, message: `"${trimmedName}" added successfully.` };
  }

  function updateProduct(id, { name, category, price }) {
    const trimmedName = name.trim();
    const trimmedCategory = category.trim();
    const parsedPrice = parseFloat(price);

    if (!trimmedName || !trimmedCategory || !Number.isFinite(parsedPrice) || parsedPrice < 0) {
      return { ok: false, message: "Please fill in all fields with valid values." };
    }

    const duplicate = products.value.some(
      (p) => p.id !== id && p.name.toLowerCase() === trimmedName.toLowerCase(),
    );
    if (duplicate) {
      return { ok: false, message: `A product named "${trimmedName}" already exists.` };
    }

    const product = products.value.find((p) => p.id === id);
    if (!product) {
      return { ok: false, message: "Product not found." };
    }

    product.name = trimmedName;
    product.category = trimmedCategory;
    product.price = Math.round(parsedPrice * 100) / 100;
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

  function resetToDefaults() {
    products.value = [...DEFAULT_CATALOG];
    saveProductsToStorage();
    return { ok: true, message: "Product catalog reset to defaults." };
  }

  return {
    products,
    categories,
    totalProducts,
    addProduct,
    updateProduct,
    deleteProduct,
    resetToDefaults,
  };
});

import { computed, ref } from "vue";
import { defineStore } from "pinia";

const TAX_RATE = 0.08;

const PRODUCT_CATALOG = [
  { id: "p-001", name: "Bottled Water", category: "Drinks", price: 1.0 },
  { id: "p-002", name: "Sparkling Soda", category: "Drinks", price: 1.75 },
  { id: "p-003", name: "Classic Burger", category: "Food", price: 5.5 },
  { id: "p-004", name: "Chicken Sandwich", category: "Food", price: 6.25 },
  { id: "p-005", name: "French Fries", category: "Sides", price: 2.5 },
  { id: "p-006", name: "Garden Salad", category: "Sides", price: 3.75 },
  { id: "p-007", name: "Chocolate Bar", category: "Snacks", price: 1.25 },
  { id: "p-008", name: "Fresh Coffee", category: "Drinks", price: 2.25 },
];

export const usePosStore = defineStore("pos", () => {
  const searchTerm = ref("");
  const products = ref(PRODUCT_CATALOG);
  const cartItems = ref([]);

  const filteredProducts = computed(() => {
    const normalizedSearch = searchTerm.value.trim().toLowerCase();

    if (!normalizedSearch) {
      return products.value;
    }

    return products.value.filter((product) => {
      return (
        product.name.toLowerCase().includes(normalizedSearch) ||
        product.category.toLowerCase().includes(normalizedSearch)
      );
    });
  });

  const subtotal = computed(() => {
    return cartItems.value.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0,
    );
  });

  const taxAmount = computed(() => subtotal.value * TAX_RATE);
  const grandTotal = computed(() => subtotal.value + taxAmount.value);

  const totalItems = computed(() => {
    return cartItems.value.reduce((sum, item) => sum + item.quantity, 0);
  });

  function addToCart(product) {
    const cartItem = cartItems.value.find(
      (item) => item.productId === product.id,
    );

    if (cartItem) {
      cartItem.quantity += 1;
      return;
    }

    cartItems.value.push({
      productId: product.id,
      name: product.name,
      price: product.price,
      quantity: 1,
    });
  }

  function updateQuantity(productId, quantity) {
    const nextQuantity = Number(quantity);

    if (!Number.isFinite(nextQuantity)) {
      return;
    }

    if (nextQuantity <= 0) {
      cartItems.value = cartItems.value.filter(
        (item) => item.productId !== productId,
      );
      return;
    }

    const cartItem = cartItems.value.find(
      (item) => item.productId === productId,
    );

    if (!cartItem) {
      return;
    }

    cartItem.quantity = Math.min(99, Math.floor(nextQuantity));
  }

  function removeFromCart(productId) {
    cartItems.value = cartItems.value.filter(
      (item) => item.productId !== productId,
    );
  }

  function clearCart() {
    cartItems.value = [];
  }

  function checkout() {
    if (cartItems.value.length === 0) {
      return {
        ok: false,
        message: "Add at least one item before checkout.",
      };
    }

    const orderNumber = `ORD-${Date.now()}`;
    const checkedOutItems = cartItems.value.map((item) => ({ ...item }));
    const orderSummary = {
      orderNumber,
      itemCount: totalItems.value,
      subtotal: subtotal.value,
      tax: taxAmount.value,
      total: grandTotal.value,
      checkedOutAt: new Date().toISOString(),
      items: checkedOutItems,
    };

    clearCart();

    return {
      ok: true,
      message: `Payment captured for ${orderNumber}.`,
      order: orderSummary,
    };
  }

  return {
    searchTerm,
    products,
    filteredProducts,
    cartItems,
    subtotal,
    taxAmount,
    grandTotal,
    totalItems,
    addToCart,
    updateQuantity,
    removeFromCart,
    clearCart,
    checkout,
  };
});

import { computed, ref } from "vue";
import { defineStore } from "pinia";
import { useOrdersStore } from "./orders";
import { useProductsStore } from "./products";

const TAX_RATE = 0.08;

export const usePosStore = defineStore("pos", () => {
  const searchTerm = ref("");
  const cartItems = ref([]);

  const productsStore = useProductsStore();
  const products = computed(() => productsStore.products);

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

    const ordersStore = useOrdersStore();
    ordersStore.addOrder(orderSummary);

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

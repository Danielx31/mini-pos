import { computed, ref } from "vue";
import { defineStore } from "pinia";
import { useOrdersStore } from "./orders";
import { useProductsStore } from "./products";
import { useCouponsStore } from "./coupons";
import { TAX_RATE } from "../constants/routes";

export const usePosStore = defineStore("pos", () => {
  const searchTerm = ref("");
  const cartItems = ref([]);
  const appliedCoupon = ref(null);
  const couponCode = ref("");
  const couponError = ref("");

  const productsStore = useProductsStore();
  const couponsStore = useCouponsStore();
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

  const discountAmount = computed(() =>
    couponsStore.calculateDiscount(appliedCoupon.value, subtotal.value),
  );
  const discountedSubtotal = computed(
    () => subtotal.value - discountAmount.value,
  );
  const taxAmount = computed(() => discountedSubtotal.value * TAX_RATE);
  const grandTotal = computed(() => discountedSubtotal.value + taxAmount.value);

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
    removeCoupon();
  }

  function applyCoupon() {
    couponError.value = "";

    const result = couponsStore.validateCoupon(
      couponCode.value,
      subtotal.value,
    );

    if (!result.ok) {
      couponError.value = result.message;
      return;
    }

    appliedCoupon.value = { ...result.coupon };
    couponCode.value = "";
  }

  function removeCoupon() {
    appliedCoupon.value = null;
    couponCode.value = "";
    couponError.value = "";
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
    const discount = discountAmount.value;
    const couponSnapshot = appliedCoupon.value
      ? { ...appliedCoupon.value }
      : null;

    const orderSummary = {
      orderNumber,
      itemCount: totalItems.value,
      subtotal: subtotal.value,
      discount,
      coupon: couponSnapshot,
      tax: taxAmount.value,
      total: grandTotal.value,
      checkedOutAt: new Date().toISOString(),
      items: checkedOutItems,
    };

    if (couponSnapshot) {
      couponsStore.recordUsage(couponSnapshot.id);
    }

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
    appliedCoupon,
    couponCode,
    couponError,
    discountAmount,
    discountedSubtotal,
    removeFromCart,
    clearCart,
    applyCoupon,
    removeCoupon,
    checkout,
  };
});

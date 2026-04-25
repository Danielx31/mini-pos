import { computed, ref } from "vue";
import { defineStore } from "pinia";
import { useOrdersStore } from "./orders";
import { useProductsStore } from "./products";
import { useCouponsStore } from "./coupons";
import { usePaymentStore } from "./payment";
import { useTaxStore } from "./taxes";
import { DEFAULT_TAX_RATE, formatTaxRate } from "../constants/taxes";

export const usePosStore = defineStore("pos", () => {
  const searchTerm = ref("");
  const cartItems = ref([]);
  const appliedCoupon = ref(null);
  const couponCode = ref("");
  const couponError = ref("");

  const productsStore = useProductsStore();
  const couponsStore = useCouponsStore();
  const taxStore = useTaxStore();
  const products = computed(() => productsStore.products);

  const filteredProducts = computed(() => {
    const normalizedSearch = searchTerm.value.trim().toLowerCase();

    if (!normalizedSearch) {
      return products.value;
    }

    return products.value.filter((product) => {
      return (
        product.name.toLowerCase().includes(normalizedSearch) ||
        product.category.toLowerCase().includes(normalizedSearch) ||
        product.id.toLowerCase().includes(normalizedSearch) ||
        product.sku?.toLowerCase().includes(normalizedSearch)
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

  const discountedRatio = computed(() => {
    if (subtotal.value <= 0) {
      return 0;
    }
    return Math.max(0, discountedSubtotal.value / subtotal.value);
  });

  const taxAmount = computed(() => {
    return cartItems.value.reduce((sum, item) => {
      const itemTotal = item.price * item.quantity * discountedRatio.value;
      return sum + itemTotal * taxStore.getTaxRate(item.category);
    }, 0);
  });

  const grandTotal = computed(() => discountedSubtotal.value + taxAmount.value);

  const taxRateSummary = computed(() => {
    const rates = cartItems.value
      .map((item) => taxStore.getTaxRate(item.category))
      .filter((rate) => Number.isFinite(rate));

    const uniqueRates = [...new Set(rates)];
    if (uniqueRates.length === 0) {
      return formatTaxRate(DEFAULT_TAX_RATE);
    }

    if (uniqueRates.length === 1) {
      return formatTaxRate(uniqueRates[0]);
    }

    return "Variable rates";
  });

  const totalItems = computed(() => {
    return cartItems.value.reduce((sum, item) => sum + item.quantity, 0);
  });

  function addToCart(product) {
    // Check if product is in stock
    if (!productsStore.checkStockAvailability(product.id, 1)) {
      return { ok: false, message: `"${product.name}" is out of stock.` };
    }

    const cartItem = cartItems.value.find(
      (item) => item.productId === product.id,
    );

    if (cartItem) {
      // Check if adding one more would exceed available stock
      if (!productsStore.checkStockAvailability(product.id, cartItem.quantity + 1)) {
        return { ok: false, message: `Cannot add more "${product.name}". Only ${productsStore.getProductStock(product.id)} available.` };
      }
      cartItem.quantity += 1;
      return { ok: true };
    }

    cartItems.value.push({
      productId: product.id,
      name: product.name,
      category: product.category,
      price: product.price,
      quantity: 1,
    });
    return { ok: true };
  }

  function addToCartByBarcode(code) {
    const normalizedCode = String(code || "").trim();
    if (!normalizedCode) {
      return { ok: false, message: "Enter a barcode or SKU to add a product." };
    }

    const product = productsStore.getProductByBarcode(normalizedCode);
    if (!product) {
      return { ok: false, message: `No product found for barcode/SKU "${normalizedCode}".` };
    }

    const result = addToCart(product);
    if (!result.ok) {
      return result;
    }

    return { ok: true, message: `Added "${product.name}" to cart.` };
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

    // Check stock availability
    if (!productsStore.checkStockAvailability(productId, nextQuantity)) {
      return { ok: false, message: `Cannot update quantity. Only ${productsStore.getProductStock(productId)} available.` };
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

  function initiateCheckout() {
    if (cartItems.value.length === 0) {
      return {
        ok: false,
        message: "Add at least one item before checkout.",
      };
    }

    return {
      ok: true,
      message: "Ready to proceed with payment.",
    };
  }

  function completeCheckout() {
    const paymentStore = usePaymentStore();

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

    const paymentSnapshot = paymentStore.getPaymentSnapshot(grandTotal.value);

    const orderSummary = {
      orderNumber,
      itemCount: totalItems.value,
      subtotal: subtotal.value,
      discount,
      coupon: couponSnapshot,
      tax: taxAmount.value,
      taxRateSummary: taxRateSummary.value,
      total: grandTotal.value,
      payment: paymentSnapshot,
      checkedOutAt: new Date().toISOString(),
      items: checkedOutItems,
    };

    if (couponSnapshot) {
      couponsStore.recordUsage(couponSnapshot.id);
    }

    // Decrement stock for each item in the order
    for (const item of checkedOutItems) {
      const result = productsStore.decrementStock(item.productId, item.quantity);
      if (!result.ok) {
        // This shouldn't happen since we validate stock before checkout, but just in case
        console.error("Stock decrement failed:", result.message);
      }
    }

    clearCart();
    paymentStore.resetPayment();

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
    taxRateSummary,
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
    initiateCheckout,
    completeCheckout,
    addToCartByBarcode,
  };
});

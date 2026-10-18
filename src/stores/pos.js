import { computed, ref } from "vue";
import { defineStore } from "pinia";
import { useOrdersStore } from "./orders";
import { useProductsStore } from "./products";
import { useCouponsStore } from "./coupons";
import { usePaymentStore } from "./payment";
import { useTaxStore } from "./taxes";
import { DEFAULT_TAX_RATE, formatTaxRate } from "../constants/taxes";
import { api } from "../lib/api";
import { fromCents, lineDiscountCents, taxCents as taxCentsForLine, toCents } from "../../shared/money.js";

const MAX_CART_QUANTITY = 99;

export const usePosStore = defineStore("pos", () => {
  const searchTerm = ref("");
  const cartItems = ref([]);
  const appliedCoupon = ref(null);
  const couponCode = ref("");
  const couponError = ref("");
  const parkedOrders = ref([]);
  const pendingHold = ref(null);
  const pendingRecall = ref(null);
  const isHolding = ref(false);
  const isRecalling = ref(false);
  const isHoldPending = computed(() => Boolean(pendingHold.value || pendingRecall.value));
  const hasPendingHold = computed(() => Boolean(pendingHold.value));
  const pendingRecallNumber = computed(() => pendingRecall.value?.holdNumber ?? null);
  const checkoutKey = ref(crypto.randomUUID());
  const isPreparingCheckout = ref(false);
  const isCompletingCheckout = ref(false);

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

  const subtotalCents = computed(() => cartItems.value.reduce((sum, item) => sum + toCents(item.price) * item.quantity, 0));
  const discountCents = computed(() => couponsStore.calculateDiscountCents(appliedCoupon.value, subtotalCents.value));
  const taxTotalCents = computed(() => {
    let allocatedDiscount = 0;
    let cumulativeLineCents = 0;
    return cartItems.value.reduce((sum, item) => {
      const lineCents = toCents(item.price) * item.quantity;
      cumulativeLineCents += lineCents;
      const lineDiscount = lineDiscountCents(discountCents.value, subtotalCents.value, cumulativeLineCents, allocatedDiscount);
      allocatedDiscount += lineDiscount;
      return sum + taxCentsForLine(lineCents - lineDiscount, taxStore.getTaxRate(item.category));
    }, 0);
  });
  const subtotal = computed(() => fromCents(subtotalCents.value));
  const discountAmount = computed(() => fromCents(discountCents.value));
  const discountedSubtotal = computed(() => fromCents(subtotalCents.value - discountCents.value));
  const taxAmount = computed(() => fromCents(taxTotalCents.value));
  const grandTotal = computed(() => fromCents(subtotalCents.value - discountCents.value + taxTotalCents.value));

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

  const totalParkedOrders = computed(() => parkedOrders.value.length);

  function addToCart(product) {
    if (isHoldPending.value) return { ok: false, message: "Finish the pending hold or recall before changing the cart." };
    // Check if product is in stock
    if (!productsStore.checkStockAvailability(product.id, 1)) {
      return { ok: false, message: `"${product.name}" is out of stock.` };
    }

    const cartItem = cartItems.value.find(
      (item) => item.productId === product.id,
    );

    if (cartItem) {
      if (cartItem.quantity >= MAX_CART_QUANTITY) return { ok: false, message: `A sale may contain at most ${MAX_CART_QUANTITY} of each product.` };
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
    if (isHoldPending.value) return { ok: false, message: "Finish the pending hold or recall before changing the cart." };
    const nextQuantity = typeof quantity === "string" && /^\d+$/.test(quantity) ? Number(quantity) : quantity;

    if (!Number.isSafeInteger(nextQuantity) || nextQuantity < 0 || nextQuantity > MAX_CART_QUANTITY) {
      return { ok: false, message: `Quantity must be a whole number between 0 and ${MAX_CART_QUANTITY}.` };
    }

    if (nextQuantity === 0) {
      cartItems.value = cartItems.value.filter(
        (item) => item.productId !== productId,
      );
      return { ok: true };
    }

    // Check stock availability
    if (!productsStore.checkStockAvailability(productId, nextQuantity)) {
      return { ok: false, message: `Cannot update quantity. Only ${productsStore.getProductStock(productId)} available.` };
    }

    const cartItem = cartItems.value.find(
      (item) => item.productId === productId,
    );

    if (!cartItem) {
      return { ok: false, message: "Product not found in cart." };
    }

    cartItem.quantity = nextQuantity;
    return { ok: true };
  }

  function removeFromCart(productId) {
    if (isHoldPending.value) return;
    cartItems.value = cartItems.value.filter(
      (item) => item.productId !== productId,
    );
  }

  function clearCart() {
    if (isHoldPending.value) return;
    cartItems.value = [];
    checkoutKey.value = crypto.randomUUID();
    removeCoupon();
  }

  function applyCoupon() {
    if (isHoldPending.value) {
      couponError.value = "Finish the pending hold or recall before changing the cart.";
      return;
    }
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
    if (isHoldPending.value) return;
    appliedCoupon.value = null;
    couponCode.value = "";
    couponError.value = "";
  }

  async function initiateCheckout() {
    if (isHoldPending.value) return { ok: false, message: "Finish the pending hold or recall before checkout." };
    if (isPreparingCheckout.value || isCompletingCheckout.value) {
      return { ok: false, message: "Checkout is already in progress." };
    }
    if (cartItems.value.length === 0) {
      return {
        ok: false,
        message: "Add at least one item before checkout.",
      };
    }

    isPreparingCheckout.value = true;
    try {
      const latestProducts = await api("/products");
      if (!Array.isArray(latestProducts)) throw new Error("Could not check current stock. Please try again.");
      if (cartItems.value.length === 0) return { ok: false, message: "Add at least one item before checkout." };
      productsStore.products = latestProducts;
      const byId = new Map(latestProducts.map((product) => [product.id, product]));
      for (const item of cartItems.value) {
        const product = byId.get(item.productId);
        if (!product) return { ok: false, message: `"${item.name}" is no longer available. Remove it from the cart.` };
        if (!Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 99) {
          return { ok: false, message: `Invalid quantity for "${item.name}". Update the cart before checkout.` };
        }
        if (product.stock < item.quantity) {
          return { ok: false, message: `Only ${product.stock} of "${product.name}" available. Update the cart before checkout.` };
        }
      }
      let priceChanged = false;
      for (const item of cartItems.value) {
        const product = byId.get(item.productId);
        priceChanged ||= item.price !== product.price || item.category !== product.category;
        Object.assign(item, { name: product.name, category: product.category, price: product.price });
      }
      if (priceChanged) return { ok: false, message: "Product prices or taxes changed. Review the updated cart, then check out again." };
      return { ok: true, message: "Ready to record the sale and payment method." };
    } catch (error) {
      return { ok: false, message: error.message };
    } finally {
      isPreparingCheckout.value = false;
    }
  }

  async function parkCurrentOrder(options = {}) {
    if (pendingRecall.value || isHolding.value || isPreparingCheckout.value || isCompletingCheckout.value) {
      return { ok: false, message: "Finish the current hold, recall, or checkout first." };
    }
    if (cartItems.value.length === 0) {
      return {
        ok: false,
        message: "Add at least one item before holding this order.",
      };
    }

    if (!pendingHold.value) {
      pendingHold.value = { holdKey: crypto.randomUUID(),
        items: cartItems.value.map(({ productId, quantity }) => ({ productId, quantity })),
        couponCode: appliedCoupon.value?.code,
        customerLabel: options.customerLabel,
        note: options.note,
      };
    }
    isHolding.value = true;
    try {
      const result = await api("/holds", { method: "POST", body: pendingHold.value });
      if (!result.ok || !result.hold?.holdNumber || !Array.isArray(result.parkedOrders)) throw new Error("Could not confirm the saved hold.");
      pendingHold.value = null;
      parkedOrders.value = result.parkedOrders;
      clearCart();
      usePaymentStore().resetPayment();
      return result;
    } catch (error) {
      if (error.status >= 400 && error.status < 500) pendingHold.value = null;
      return { ok: false, message: pendingHold.value ? `${error.message} Hold status is uncertain. Retry Hold Order before changing the cart.` : error.message };
    } finally { isHolding.value = false; }
  }

  async function recallParkedOrder(holdNumber) {
    if (pendingHold.value || isRecalling.value || isPreparingCheckout.value || isCompletingCheckout.value || (pendingRecall.value && pendingRecall.value.holdNumber !== holdNumber)) {
      return { ok: false, message: "Finish the current hold, recall, or checkout first." };
    }
    if (cartItems.value.length > 0) {
      return {
        ok: false,
        message: "Clear the current cart before recalling a parked order.",
      };
    }

    pendingRecall.value ||= { holdNumber, recallKey: crypto.randomUUID() };
    isRecalling.value = true;
    try {
      const result = await api(`/holds/${encodeURIComponent(holdNumber)}/recall`, { method: "POST", body: { recallKey: pendingRecall.value.recallKey } });
      if (!result.ok || !Array.isArray(result.hold?.items) || !Array.isArray(result.parkedOrders)) throw new Error("Could not confirm the recalled cart.");
      pendingRecall.value = null;
      cartItems.value = result.hold.items.map((item) => ({ ...item }));
      appliedCoupon.value = result.hold.coupon;
      couponCode.value = "";
      couponError.value = "";
      parkedOrders.value = result.parkedOrders;
      return result;
    } catch (error) {
      if (error.status >= 400 && error.status < 500) pendingRecall.value = null;
      return { ok: false, message: pendingRecall.value ? `${error.message} Recall status is uncertain. Retry this hold before changing the cart.` : error.message };
    } finally { isRecalling.value = false; }
  }

  async function removeParkedOrder(holdNumber) {
    if (isHoldPending.value) return { ok: false, message: "Finish the pending hold or recall before removing a parked order." };
    try {
      const result = await api(`/holds/${encodeURIComponent(holdNumber)}`, { method: "DELETE" });
      parkedOrders.value = result.parkedOrders;
      return result;
    } catch (error) { return { ok: false, message: error.message }; }
  }

  async function completeCheckout() {
    if (isHoldPending.value) return { ok: false, message: "Finish the pending hold or recall before checkout." };
    const paymentStore = usePaymentStore();
    if (isCompletingCheckout.value) return { ok: false, message: "Checkout is already in progress." };

    if (cartItems.value.length === 0) {
      return {
        ok: false,
        message: "Add at least one item before checkout.",
      };
    }

    isCompletingCheckout.value = true;
    try {
      const result = await api("/orders", { method: "POST", body: {
        checkoutKey: checkoutKey.value,
        items: cartItems.value.map(({ productId, quantity }) => ({ productId, quantity })),
        couponCode: appliedCoupon.value?.code,
        paymentMethod: paymentStore.paymentMethod,
        cashTendered: paymentStore.cashTendered,
        customerName: paymentStore.paymentMethod === "credit" ? paymentStore.customerName.trim() : undefined,
        customerContact: paymentStore.paymentMethod === "credit" ? paymentStore.customerContact.trim() : undefined,
        dueDate: paymentStore.paymentMethod === "credit" ? paymentStore.dueDate : undefined,
      } });
      if (!result.ok || !result.order?.orderNumber || !Array.isArray(result.products) || !Array.isArray(result.coupons)) {
        throw new Error("Could not confirm the sale. Please retry checkout to check its status.");
      }
      productsStore.products = result.products;
      couponsStore.coupons = result.coupons;
      useOrdersStore().addOrder(result.order);
      clearCart();
      paymentStore.resetPayment();
      return result;
    } catch (error) { return { ok: false, message: error.message }; }
    finally { isCompletingCheckout.value = false; }
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
    parkedOrders,
    totalParkedOrders,
    isHolding,
    isRecalling,
    isHoldPending,
    hasPendingHold,
    pendingRecallNumber,
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
    isPreparingCheckout,
    isCompletingCheckout,
    completeCheckout,
    addToCartByBarcode,
    parkCurrentOrder,
    recallParkedOrder,
    removeParkedOrder,
  };
});

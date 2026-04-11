import { computed, ref } from "vue";
import { defineStore } from "pinia";

const STORAGE_KEY = "mini_pos_coupons";

const DISCOUNT_TYPE_PERCENTAGE = "percentage";
const DISCOUNT_TYPE_FIXED = "fixed";

const DEFAULT_COUPONS = [
  {
    id: 1,
    code: "SAVE10",
    description: "10% off your order",
    type: DISCOUNT_TYPE_PERCENTAGE,
    value: 10,
    minOrderAmount: 0,
    maxUses: null,
    usedCount: 0,
    active: true,
    expiresAt: null,
  },
  {
    id: 2,
    code: "FLAT5",
    description: "$5 off orders over $20",
    type: DISCOUNT_TYPE_FIXED,
    value: 5,
    minOrderAmount: 20,
    maxUses: null,
    usedCount: 0,
    active: true,
    expiresAt: null,
  },
  {
    id: 3,
    code: "WELCOME20",
    description: "20% off — one-time welcome discount",
    type: DISCOUNT_TYPE_PERCENTAGE,
    value: 20,
    minOrderAmount: 10,
    maxUses: 1,
    usedCount: 0,
    active: true,
    expiresAt: null,
  },
];

export const useCouponsStore = defineStore("coupons", () => {
  const coupons = ref(loadFromStorage());

  const activeCoupons = computed(() =>
    coupons.value.filter((coupon) => coupon.active),
  );

  function loadFromStorage() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : structuredClone(DEFAULT_COUPONS);
    } catch {
      return structuredClone(DEFAULT_COUPONS);
    }
  }

  function saveToStorage() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(coupons.value));
  }

  /**
   * Validate a coupon code against the current subtotal.
   * Returns { ok, coupon?, message } — the caller decides what to do next.
   */
  function validateCoupon(code, subtotal) {
    const normalizedCode = code.trim().toUpperCase();

    if (!normalizedCode) {
      return { ok: false, message: "Please enter a coupon code." };
    }

    const coupon = coupons.value.find(
      (c) => c.code.toUpperCase() === normalizedCode,
    );

    if (!coupon) {
      return { ok: false, message: "Coupon code not found." };
    }

    if (!coupon.active) {
      return { ok: false, message: "This coupon is no longer active." };
    }

    if (coupon.expiresAt && new Date(coupon.expiresAt) < new Date()) {
      return { ok: false, message: "This coupon has expired." };
    }

    if (coupon.maxUses !== null && coupon.usedCount >= coupon.maxUses) {
      return { ok: false, message: "This coupon has reached its usage limit." };
    }

    if (subtotal < coupon.minOrderAmount) {
      return {
        ok: false,
        message: `Minimum order of $${coupon.minOrderAmount.toFixed(2)} required.`,
      };
    }

    return { ok: true, coupon };
  }

  /**
   * Calculate the discount amount for a given coupon and subtotal.
   * The discount is capped so it never exceeds the subtotal.
   */
  function calculateDiscount(coupon, subtotal) {
    if (!coupon || subtotal <= 0) {
      return 0;
    }

    let discount = 0;

    if (coupon.type === DISCOUNT_TYPE_PERCENTAGE) {
      discount = subtotal * (coupon.value / 100);
    } else if (coupon.type === DISCOUNT_TYPE_FIXED) {
      discount = coupon.value;
    }

    return Math.min(discount, subtotal);
  }

  /**
   * Increment the used count for a coupon after a successful checkout.
   */
  function recordUsage(couponId) {
    const coupon = coupons.value.find((c) => c.id === couponId);
    if (coupon) {
      coupon.usedCount += 1;
      saveToStorage();
    }
  }

  /**
   * Format a coupon's discount for display (e.g., "10%" or "$5.00").
   */
  function formatCouponValue(coupon) {
    if (coupon.type === DISCOUNT_TYPE_PERCENTAGE) {
      return `${coupon.value}%`;
    }
    return `$${coupon.value.toFixed(2)}`;
  }

  function resetCoupons() {
    coupons.value = structuredClone(DEFAULT_COUPONS);
    saveToStorage();
  }

  return {
    coupons,
    activeCoupons,
    DISCOUNT_TYPE_PERCENTAGE,
    DISCOUNT_TYPE_FIXED,
    validateCoupon,
    calculateDiscount,
    recordUsage,
    formatCouponValue,
    resetCoupons,
  };
});

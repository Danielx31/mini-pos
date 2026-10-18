import { computed, ref } from "vue";
import { defineStore } from "pinia";
import { useCurrency } from "../composables/useFormatters";

const DISCOUNT_TYPE_PERCENTAGE = "percentage";
const DISCOUNT_TYPE_FIXED = "fixed";

export const useCouponsStore = defineStore("coupons", () => {
  const { formatCurrency } = useCurrency();
  const coupons = ref([]);
  const activeCoupons = computed(() => coupons.value.filter((coupon) => coupon.active));
  const totalCoupons = computed(() => coupons.value.length);
  function validateCoupon(code, subtotal) {
    const normalized = String(code ?? "").trim().toUpperCase();
    if (!normalized) return { ok: false, message: "Please enter a coupon code." };
    const coupon = coupons.value.find((item) => item.code.toUpperCase() === normalized);
    if (!coupon) return { ok: false, message: "Coupon code not found." };
    if (!coupon.active || (coupon.expiresAt && Date.parse(coupon.expiresAt) < Date.now()) ||
      (coupon.maxUses !== null && coupon.usedCount >= coupon.maxUses) || subtotal < coupon.minOrderAmount) {
      return { ok: false, message: "Coupon is no longer valid for this order." };
    }
    return { ok: true, coupon };
  }
  function calculateDiscount(coupon, subtotal) {
    if (!coupon || subtotal <= 0) return 0;
    return Math.min(subtotal, coupon.type === DISCOUNT_TYPE_PERCENTAGE ? subtotal * coupon.value / 100 : coupon.value);
  }
  function formatCouponValue(coupon) { return coupon.type === DISCOUNT_TYPE_PERCENTAGE ? `${coupon.value}%` : formatCurrency(coupon.value); }
  return { coupons, activeCoupons, totalCoupons, DISCOUNT_TYPE_PERCENTAGE, DISCOUNT_TYPE_FIXED, validateCoupon, calculateDiscount, formatCouponValue };
});

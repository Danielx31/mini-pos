import { computed, ref } from "vue";
import { defineStore } from "pinia";
import { useCurrency } from "../composables/useFormatters";
import { fromCents, percentageCents, toCents } from "../../shared/money.js";
import { api } from "../lib/api";

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
      (coupon.maxUses !== null && coupon.usedCount >= coupon.maxUses) || toCents(subtotal) < toCents(coupon.minOrderAmount)) {
      return { ok: false, message: "Coupon is no longer valid for this order." };
    }
    return { ok: true, coupon };
  }
  function calculateDiscountCents(coupon, subtotalCents) {
    if (!coupon || subtotalCents <= 0) return 0;
    return Math.min(subtotalCents, coupon.type === DISCOUNT_TYPE_PERCENTAGE ? percentageCents(subtotalCents, coupon.value) : toCents(coupon.value));
  }
  function calculateDiscount(coupon, subtotal) { return fromCents(calculateDiscountCents(coupon, toCents(subtotal))); }
  function formatCouponValue(coupon) { return coupon.type === DISCOUNT_TYPE_PERCENTAGE ? `${coupon.value}%` : formatCurrency(coupon.value); }
  async function loadCoupons() {
    coupons.value = await api("/coupons");
  }
  async function saveCoupon(input, id = /** @type {number | null} */ (null)) {
    const result = await api(id === null ? "/coupons" : `/coupons/${id}`, { method: id === null ? "POST" : "PUT", body: input });
    coupons.value = result.coupons;
    return result;
  }
  async function deleteCoupon(id) {
    const result = await api(`/coupons/${id}`, { method: "DELETE" });
    coupons.value = result.coupons;
    return result;
  }
  return { coupons, activeCoupons, totalCoupons, DISCOUNT_TYPE_PERCENTAGE, DISCOUNT_TYPE_FIXED, validateCoupon, calculateDiscount, calculateDiscountCents, formatCouponValue, loadCoupons, saveCoupon, deleteCoupon };
});

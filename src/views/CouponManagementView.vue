<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import AppNavbar from "../components/AppNavbar.vue";
import { useCurrency } from "../composables/useFormatters";
import { useCouponsStore } from "../stores/coupons";
import { usePosStore } from "../stores/pos";

type CouponType = "percentage" | "fixed";
type Coupon = {
  id: number;
  code: string;
  description: string;
  type: CouponType;
  value: number;
  minOrderAmount: number;
  maxUses: number | null;
  usedCount: number;
  active: boolean;
  expiresAt: string | null;
};
type CouponForm = {
  code: string;
  description: string;
  type: CouponType;
  value: string;
  minOrderAmount: string;
  maxUses: string;
  expiresAt: string;
  active: boolean;
};

const CODE_PATTERN = "[A-Za-z0-9][A-Za-z0-9_-]{2,31}";
const couponsStore = useCouponsStore();
const posStore = usePosStore();
const { formatCurrency } = useCurrency();
const coupons = computed(() => couponsStore.coupons as Coupon[]);
const isLoading = ref(true);
const isSaving = ref(false);
const editingId = ref<number | null>(null);
const notice = ref<{ ok: boolean; message: string } | null>(null);

function blankForm(): CouponForm {
  return { code: "", description: "", type: "percentage", value: "", minOrderAmount: "0", maxUses: "", expiresAt: "", active: true };
}
const form = ref<CouponForm>(blankForm());

onMounted(async () => {
  await refreshCoupons();
});

async function refreshCoupons(): Promise<void> {
  notice.value = null;
  isLoading.value = true;
  try {
    await couponsStore.loadCoupons();
  } catch (error) {
    notice.value = { ok: false, message: error instanceof Error ? error.message : "Could not load coupons." };
  } finally {
    isLoading.value = false;
  }
}

function resetForm(): void {
  editingId.value = null;
  form.value = blankForm();
}

function editCoupon(coupon: Coupon): void {
  editingId.value = coupon.id;
  form.value = {
    code: coupon.code,
    description: coupon.description,
    type: coupon.type,
    value: String(coupon.value),
    minOrderAmount: String(coupon.minOrderAmount),
    maxUses: coupon.maxUses === null ? "" : String(coupon.maxUses),
    expiresAt: coupon.expiresAt?.slice(0, 10) ?? "",
    active: coupon.active,
  };
  notice.value = null;
  document.getElementById("coupon-form")?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function couponStatus(coupon: Coupon): string {
  if (!coupon.active) return "Inactive";
  if (coupon.expiresAt && Date.parse(coupon.expiresAt) < Date.now()) return "Expired";
  if (coupon.maxUses !== null && coupon.usedCount >= coupon.maxUses) return "Used up";
  return "Active";
}

async function saveCoupon(): Promise<void> {
  notice.value = null;
  isSaving.value = true;
  const previousCode = coupons.value.find((coupon) => coupon.id === editingId.value)?.code;
  try {
    const result = await couponsStore.saveCoupon({
      code: form.value.code.trim().toUpperCase(),
      description: form.value.description.trim(),
      type: form.value.type,
      value: form.value.value,
      minOrderAmount: form.value.minOrderAmount,
      maxUses: form.value.maxUses === "" ? null : form.value.maxUses,
      expiresAt: form.value.expiresAt || null,
      active: form.value.active,
    }, editingId.value);
    if (previousCode && (posStore.appliedCoupon as Coupon | null)?.code === previousCode) posStore.removeCoupon();
    notice.value = { ok: true, message: result.message };
    resetForm();
  } catch (error) {
    notice.value = { ok: false, message: error instanceof Error ? error.message : "Could not save coupon." };
  } finally {
    isSaving.value = false;
  }
}

async function deleteCoupon(coupon: Coupon): Promise<void> {
  if (!window.confirm(`Delete coupon ${coupon.code}? Past sales keep their recorded discounts.`)) return;
  notice.value = null;
  isSaving.value = true;
  try {
    const result = await couponsStore.deleteCoupon(coupon.id);
    if ((posStore.appliedCoupon as Coupon | null)?.code === coupon.code) posStore.removeCoupon();
    if (editingId.value === coupon.id) resetForm();
    notice.value = { ok: true, message: result.message };
  } catch (error) {
    notice.value = { ok: false, message: error instanceof Error ? error.message : "Could not delete coupon." };
  } finally {
    isSaving.value = false;
  }
}
</script>

<template>
  <div class="min-h-screen bg-slate-50 text-slate-900">
    <AppNavbar show-back />
    <main class="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <header class="mb-7">
        <p class="text-sm font-semibold uppercase tracking-wide text-blue-700">Store promotions</p>
        <h1 class="mt-1 text-3xl font-bold tracking-tight">Coupons</h1>
        <p class="mt-2 max-w-2xl text-sm text-slate-600">Create and manage discounts used at checkout. Cashiers can apply active coupons, while managers and admins can change them here.</p>
      </header>

      <div v-if="notice" role="alert" aria-live="polite" class="mb-6 rounded-2xl border px-4 py-3 text-sm" :class="notice.ok ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-rose-200 bg-rose-50 text-rose-800'">
        {{ notice.message }}
      </div>

      <div class="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <section id="coupon-form" class="scroll-mt-28 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7" aria-labelledby="coupon-form-title">
          <div class="mb-6">
            <h2 id="coupon-form-title" class="text-xl font-bold">{{ editingId === null ? "New coupon" : "Edit coupon" }}</h2>
            <p class="mt-1 text-sm text-slate-600">Set the discount and the conditions for using it.</p>
          </div>
          <form class="space-y-5" @submit.prevent="saveCoupon">
            <div>
              <label for="coupon-code" class="mb-1.5 block text-sm font-medium">Code</label>
              <input id="coupon-code" v-model="form.code" type="text" autocomplete="off" required minlength="3" maxlength="32" :pattern="CODE_PATTERN" placeholder="e.g. SAVE10" class="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 uppercase text-slate-900 placeholder:normal-case focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100" />
              <p class="mt-1 text-xs text-slate-500">3–32 letters, numbers, underscores, or hyphens.</p>
            </div>
            <div>
              <label for="coupon-description" class="mb-1.5 block text-sm font-medium">Description</label>
              <input id="coupon-description" v-model="form.description" type="text" required maxlength="200" placeholder="e.g. Ten percent off" class="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100" />
            </div>
            <div class="grid gap-4 sm:grid-cols-2">
              <div>
                <label for="coupon-type" class="mb-1.5 block text-sm font-medium">Discount type</label>
                <select id="coupon-type" v-model="form.type" class="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100">
                  <option value="percentage">Percentage</option>
                  <option value="fixed">Fixed pesos</option>
                </select>
              </div>
              <div>
                <label for="coupon-value" class="mb-1.5 block text-sm font-medium">{{ form.type === "percentage" ? "Percent off" : "Pesos off" }}</label>
                <input id="coupon-value" v-model="form.value" type="number" inputmode="decimal" required :min="form.type === 'percentage' ? 1 : 0.01" :max="form.type === 'percentage' ? 100 : 1000000" :step="form.type === 'percentage' ? 1 : 0.01" class="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100" />
              </div>
              <div>
                <label for="coupon-minimum" class="mb-1.5 block text-sm font-medium">Minimum order (₱)</label>
                <input id="coupon-minimum" v-model="form.minOrderAmount" type="number" inputmode="decimal" required min="0" max="1000000" step="0.01" class="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100" />
              </div>
              <div>
                <label for="coupon-limit" class="mb-1.5 block text-sm font-medium">Usage limit</label>
                <input id="coupon-limit" v-model="form.maxUses" type="number" inputmode="numeric" min="1" max="2147483647" step="1" placeholder="No limit" class="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100" />
              </div>
              <div class="sm:col-span-2">
                <label for="coupon-expiry" class="mb-1.5 block text-sm font-medium">Expiry date</label>
                <input id="coupon-expiry" v-model="form.expiresAt" type="date" class="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100" />
                <p class="mt-1 text-xs text-slate-500">Optional. Valid through the selected day in Philippine time.</p>
              </div>
            </div>
            <label class="flex items-center gap-3 rounded-xl bg-slate-50 px-4 py-3 text-sm font-medium">
              <input v-model="form.active" type="checkbox" class="h-4 w-4 rounded border-slate-300 text-blue-600" />
              Active at checkout
            </label>
            <div class="flex flex-col gap-3 border-t border-slate-100 pt-5 sm:flex-row">
              <button type="submit" :disabled="isSaving" class="rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60">{{ isSaving ? "Saving..." : editingId === null ? "Create coupon" : "Save changes" }}</button>
              <button v-if="editingId !== null" type="button" :disabled="isSaving" class="rounded-xl border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50" @click="resetForm">Cancel edit</button>
            </div>
          </form>
        </section>

        <section class="min-w-0 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7" aria-labelledby="coupon-list-title">
          <div class="mb-5 flex items-center justify-between gap-3">
            <div>
              <h2 id="coupon-list-title" class="text-xl font-bold">Saved coupons</h2>
              <p class="mt-1 text-sm text-slate-600">{{ coupons.length }} total</p>
            </div>
            <button type="button" :disabled="isLoading || isSaving" class="rounded-xl border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60" @click="refreshCoupons">Refresh</button>
          </div>
          <p v-if="isLoading" class="py-10 text-center text-sm text-slate-600">Loading coupons...</p>
          <p v-else-if="coupons.length === 0" class="rounded-2xl border border-dashed border-slate-300 px-5 py-10 text-center text-sm text-slate-600">No coupons yet. Create one using the form.</p>
          <ul v-else class="space-y-3">
            <li v-for="coupon in coupons" :key="coupon.id" class="min-w-0 rounded-2xl border border-slate-200 p-4">
              <div class="flex flex-wrap items-start justify-between gap-2">
                <div class="min-w-0">
                  <p class="break-all font-bold tracking-wide text-slate-900">{{ coupon.code }}</p>
                  <p class="mt-1 text-sm text-slate-600">{{ coupon.description }}</p>
                </div>
                <span class="rounded-full px-2.5 py-1 text-xs font-semibold" :class="couponStatus(coupon) === 'Active' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-700'">{{ couponStatus(coupon) }}</span>
              </div>
              <div class="mt-4 grid grid-cols-2 gap-3 text-sm">
                <p><span class="block text-xs text-slate-500">Discount</span><strong>{{ couponsStore.formatCouponValue(coupon) }}</strong></p>
                <p><span class="block text-xs text-slate-500">Minimum order</span><strong>{{ formatCurrency(coupon.minOrderAmount) }}</strong></p>
                <p><span class="block text-xs text-slate-500">Uses</span><strong>{{ coupon.usedCount }} / {{ coupon.maxUses ?? "Unlimited" }}</strong></p>
                <p><span class="block text-xs text-slate-500">Expires</span><strong>{{ coupon.expiresAt ? coupon.expiresAt.slice(0, 10) : "Never" }}</strong></p>
              </div>
              <div class="mt-4 flex gap-2 border-t border-slate-100 pt-4">
                <button type="button" :disabled="isSaving" class="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60" @click="editCoupon(coupon)">Edit</button>
                <button type="button" :disabled="isSaving" class="rounded-lg border border-rose-200 px-4 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-60" @click="deleteCoupon(coupon)">Delete</button>
              </div>
            </li>
          </ul>
          <p class="mt-5 text-xs leading-5 text-slate-500">Coupons in parked orders must be cleared before editing or deleting. Past sales retain their original discount.</p>
        </section>
      </div>
    </main>
  </div>
</template>

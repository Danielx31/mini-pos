import { computed, ref } from "vue";
import { defineStore } from "pinia";
import { api } from "../lib/api";
import { CATEGORY_TAX_RATES, DEFAULT_TAX_RATE } from "../constants/taxes";

export const useTaxStore = defineStore("taxes", () => {
  const categoryTaxRates = ref({});
  const effectiveTaxRates = computed(() => ({ ...CATEGORY_TAX_RATES, ...categoryTaxRates.value }));
  function getTaxRate(category) { return effectiveTaxRates.value[category] ?? DEFAULT_TAX_RATE; }
  async function setTaxRate(category, rate) {
    try {
      const result = await api(`/tax-rates/${encodeURIComponent(category)}`, { method: "PUT", body: { rate } });
      categoryTaxRates.value = result.taxRates;
      return result;
    } catch (error) { return { ok: false, message: error.message }; }
  }
  async function resetTaxRates() {
    try {
      const result = await api("/tax-rates", { method: "DELETE" });
      categoryTaxRates.value = result.taxRates;
      return result;
    } catch (error) { return { ok: false, message: error.message }; }
  }
  return { categoryTaxRates, effectiveTaxRates, getTaxRate, setTaxRate, resetTaxRates };
});

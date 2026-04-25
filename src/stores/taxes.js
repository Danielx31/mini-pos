import { computed, ref } from "vue";
import { defineStore } from "pinia";
import { CATEGORY_TAX_RATES, DEFAULT_TAX_RATE } from "../constants/taxes";

const STORAGE_KEY = "mini_pos_category_tax_rates";

export const useTaxStore = defineStore("taxes", () => {
  const categoryTaxRates = ref(loadTaxRatesFromStorage());

  const effectiveTaxRates = computed(() => ({
    ...CATEGORY_TAX_RATES,
    ...categoryTaxRates.value,
  }));

  function loadTaxRatesFromStorage() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) {
        return {};
      }
      return JSON.parse(stored);
    } catch {
      return {};
    }
  }

  function saveTaxRatesToStorage() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(categoryTaxRates.value));
  }

  function getTaxRate(category) {
    if (!category) {
      return DEFAULT_TAX_RATE;
    }

    return (
      categoryTaxRates.value[category] ?? CATEGORY_TAX_RATES[category] ?? DEFAULT_TAX_RATE
    );
  }

  function setTaxRate(category, rate) {
    const parsedRate = parseFloat(rate);
    if (!category || !Number.isFinite(parsedRate) || parsedRate < 0 || parsedRate > 1) {
      return {
        ok: false,
        message: "Enter a valid tax rate between 0 and 1 for the selected category.",
      };
    }

    categoryTaxRates.value = {
      ...categoryTaxRates.value,
      [category]: parsedRate,
    };
    saveTaxRatesToStorage();

    return {
      ok: true,
      message: `Tax rate for ${category} updated to ${Math.round(parsedRate * 100)}%.`,
    };
  }

  function resetTaxRates() {
    categoryTaxRates.value = {};
    saveTaxRatesToStorage();
    return {
      ok: true,
      message: "Category tax rates reset to defaults.",
    };
  }

  return {
    categoryTaxRates,
    effectiveTaxRates,
    getTaxRate,
    setTaxRate,
    resetTaxRates,
  };
});

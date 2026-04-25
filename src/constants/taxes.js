export const DEFAULT_TAX_RATE = 0.08;

export const CATEGORY_TAX_RATES = {
  Food: 0.05,
  Drinks: 0.08,
  Sides: 0.08,
  Snacks: 0.1,
};

export function getTaxRateForCategory(category) {
  if (!category) {
    return DEFAULT_TAX_RATE;
  }

  return CATEGORY_TAX_RATES[category] ?? DEFAULT_TAX_RATE;
}

export function formatTaxRate(rate) {
  return `${Math.round((rate ?? DEFAULT_TAX_RATE) * 100)}%`;
}

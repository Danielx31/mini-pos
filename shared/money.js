export const CENTS_PER_UNIT = 100;
const TAX_RATE_SCALE = 10_000;
const MAX_INPUT_UNITS = 1_000_000;

function roundedRatio(numerator, denominator) {
  return Number((BigInt(numerator) + BigInt(denominator) / 2n) / BigInt(denominator));
}

export function parseCents(value) {
  const input = typeof value === "number" || typeof value === "string" ? String(value) : "";
  if (!/^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/.test(input)) return null;
  const [whole, fraction = ""] = input.split(".");
  const amountCents = Number(whole) * CENTS_PER_UNIT + Number(fraction.padEnd(2, "0"));
  return Number.isSafeInteger(amountCents) && amountCents <= MAX_INPUT_UNITS * CENTS_PER_UNIT ? amountCents : null;
}

// Convert a trusted peso amount at the API boundary, before doing arithmetic.
export function toCents(amount) {
  return Math.round(Number(amount) * CENTS_PER_UNIT);
}

export function fromCents(amountCents) {
  return amountCents / CENTS_PER_UNIT;
}

export function lineTotal(amount, quantity) {
  return fromCents(toCents(amount) * quantity);
}

export function percentageCents(amountCents, percent) {
  return roundedRatio(BigInt(amountCents) * BigInt(percent), CENTS_PER_UNIT);
}

export function taxCents(amountCents, rate) {
  return roundedRatio(BigInt(amountCents) * BigInt(Math.round(rate * TAX_RATE_SCALE)), TAX_RATE_SCALE);
}

export function formatPercentRate(rate) {
  return `${Math.round(rate * TAX_RATE_SCALE) / 100}%`;
}

export function lineDiscountCents(discountCents, subtotalCents, cumulativeLineCents, allocatedCents) {
  if (subtotalCents === 0) return 0;
  return roundedRatio(BigInt(discountCents) * BigInt(cumulativeLineCents), subtotalCents) - allocatedCents;
}

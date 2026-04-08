const CURRENCY_CODE = "USD";
const LOCALE = "en-US";

const currencyFormatter = new Intl.NumberFormat(LOCALE, {
  style: "currency",
  currency: CURRENCY_CODE,
});

const dateTimeOptions = Object.freeze({
  year: "numeric",
  month: "short",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

export function useCurrency() {
  function formatCurrency(value) {
    return currencyFormatter.format(value);
  }

  return { formatCurrency };
}

export function useDateTime() {
  function formatDateTime(isoString) {
    const date = new Date(isoString);
    return date.toLocaleDateString(LOCALE, dateTimeOptions);
  }

  return { formatDateTime };
}

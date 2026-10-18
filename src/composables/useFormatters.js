const CURRENCY_CODE = "PHP";
const CURRENCY_LOCALE = "en-PH";
const DATE_LOCALE = "en-US";

const currencyFormatter = new Intl.NumberFormat(CURRENCY_LOCALE, {
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
    return date.toLocaleDateString(DATE_LOCALE, dateTimeOptions);
  }

  return { formatDateTime };
}

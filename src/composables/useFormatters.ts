const CURRENCY_CODE = "PHP";
const CURRENCY_LOCALE = "en-PH";
const DATE_LOCALE = "en-US";

const currencyFormatter = new Intl.NumberFormat(CURRENCY_LOCALE, {
  style: "currency",
  currency: CURRENCY_CODE,
});

const dateTimeOptions: Intl.DateTimeFormatOptions = Object.freeze({
  year: "numeric",
  month: "short",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

export function useCurrency() {
  function formatCurrency(value: number): string {
    return currencyFormatter.format(value);
  }

  return { formatCurrency };
}

export function useDateTime() {
  function formatDateTime(isoString: string): string {
    return new Date(isoString).toLocaleDateString(DATE_LOCALE, dateTimeOptions);
  }

  return { formatDateTime };
}

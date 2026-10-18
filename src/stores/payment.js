import { ref } from "vue";
import { defineStore } from "pinia";
import { fromCents, parseCents, toCents } from "../../shared/money.js";

export const PAYMENT_METHODS = {
  CASH: "cash",
  CARD: "card",
  EWALKET: "e-wallet",
  CREDIT: "credit",
};

export const usePaymentStore = defineStore("payment", () => {
  const paymentMethod = ref(null);
  const cashTendered = ref(0);
  const customerName = ref("");
  const customerContact = ref("");
  const dueDate = ref("");
  const isPaymentModalOpen = ref(false);

  function setPaymentMethod(method) {
    if (Object.values(PAYMENT_METHODS).includes(method)) {
      paymentMethod.value = method;
      if (method !== PAYMENT_METHODS.CASH) {
        cashTendered.value = 0;
      }
    }
  }

  function setCashTendered(amount) {
    const amountCents = parseCents(amount);
    cashTendered.value = amountCents === null ? 0 : fromCents(amountCents);
  }

  function calculateChange(totalAmount) {
    if (paymentMethod.value === PAYMENT_METHODS.CASH) {
      return fromCents(Math.max(0, toCents(cashTendered.value) - toCents(totalAmount)));
    }
    return 0;
  }

  function isValidPaymentForAmount(totalAmount) {
    if (paymentMethod.value === PAYMENT_METHODS.CASH) {
      return toCents(cashTendered.value) > 0 && toCents(cashTendered.value) >= toCents(totalAmount);
    }
    if (paymentMethod.value === PAYMENT_METHODS.CREDIT) {
      return totalAmount > 0 && customerName.value.trim().length > 0 && customerName.value.trim().length <= 100 && customerContact.value.trim().length <= 100;
    }
    return [PAYMENT_METHODS.CARD, PAYMENT_METHODS.EWALKET].includes(paymentMethod.value);
  }

  function isCashPaymentMethod() {
    return paymentMethod.value === PAYMENT_METHODS.CASH;
  }

  function openPaymentModal() {
    paymentMethod.value = null;
    cashTendered.value = 0;
    customerName.value = "";
    customerContact.value = "";
    dueDate.value = "";
    isPaymentModalOpen.value = true;
  }

  function closePaymentModal() {
    isPaymentModalOpen.value = false;
  }

  function resetPayment() {
    paymentMethod.value = null;
    cashTendered.value = 0;
    customerName.value = "";
    customerContact.value = "";
    dueDate.value = "";
    isPaymentModalOpen.value = false;
  }

  function getPaymentSnapshot(totalAmount) {
    return {
      paymentMethod: paymentMethod.value,
      cashTendered:
        paymentMethod.value === PAYMENT_METHODS.CASH ? cashTendered.value : null,
      change:
        paymentMethod.value === PAYMENT_METHODS.CASH
          ? calculateChange(totalAmount)
          : null,
    };
  }

  return {
    paymentMethod,
    cashTendered,
    customerName,
    customerContact,
    dueDate,
    isPaymentModalOpen,
    setPaymentMethod,
    setCashTendered,
    calculateChange,
    isValidPaymentForAmount,
    isCashPaymentMethod,
    openPaymentModal,
    closePaymentModal,
    resetPayment,
    getPaymentSnapshot,
  };
});


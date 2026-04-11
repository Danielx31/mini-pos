import { ref } from "vue";
import { defineStore } from "pinia";

export const PAYMENT_METHODS = {
  CASH: "cash",
  CARD: "card",
  EWALKET: "e-wallet",
};

export const usePaymentStore = defineStore("payment", () => {
  const paymentMethod = ref(PAYMENT_METHODS.CARD);
  const cashTendered = ref(0);
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
    const numAmount = Number(amount);
    if (Number.isFinite(numAmount) && numAmount >= 0) {
      cashTendered.value = numAmount;
    }
  }

  function calculateChange(totalAmount) {
    if (paymentMethod.value === PAYMENT_METHODS.CASH) {
      return Math.max(0, cashTendered.value - totalAmount);
    }
    return 0;
  }

  function isValidPaymentForAmount(totalAmount) {
    if (paymentMethod.value === PAYMENT_METHODS.CASH) {
      return cashTendered.value > 0 && cashTendered.value >= totalAmount;
    }
    return true;
  }

  function isCashPaymentMethod() {
    return paymentMethod.value === PAYMENT_METHODS.CASH;
  }

  function openPaymentModal() {
    isPaymentModalOpen.value = true;
  }

  function closePaymentModal() {
    isPaymentModalOpen.value = false;
  }

  function resetPayment() {
    paymentMethod.value = PAYMENT_METHODS.CARD;
    cashTendered.value = 0;
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


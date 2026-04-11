<script setup>
import { computed, ref } from "vue";
import { usePaymentStore, PAYMENT_METHODS } from "../stores/payment";
import { useCurrency } from "../composables/useFormatters";

const props = defineProps({
  totalAmount: {
    type: Number,
    required: true,
  },
});

const emit = defineEmits(["confirm", "cancel"]);

const paymentStore = usePaymentStore();
const { formatCurrency } = useCurrency();

const cashInput = ref("");

function handlePaymentMethodChange(method) {
  paymentStore.setPaymentMethod(method);
  cashInput.value = "";
}

function handleCashInputChange(event) {
  const value = event.target.value;
  cashInput.value = value;
  paymentStore.setCashTendered(value);
}

const change = computed(() => {
  return paymentStore.calculateChange(props.totalAmount);
});

const isValidPayment = computed(() => {
  return paymentStore.isValidPaymentForAmount(props.totalAmount);
});

const isCash = computed(() => {
  return paymentStore.isCashPaymentMethod();
});

function confirmPayment() {
  if (!isValidPayment.value) {
    return;
  }
  emit("confirm");
}

function cancelPayment() {
  emit("cancel");
}
</script>

<template>
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
    <div class="w-full max-w-md rounded-[2rem] border border-slate-200 bg-white p-6 shadow-2xl">
      <!-- Header -->
      <div class="mb-6">
        <h2 class="text-2xl font-bold text-slate-900">Select Payment Method</h2>
        <p class="mt-1 text-sm text-slate-500">
          Choose how to process this payment
        </p>
      </div>

      <!-- Total Amount Display -->
      <div class="mb-6 rounded-2xl bg-slate-50 p-4">
        <p class="text-sm font-medium text-slate-600">Total Amount Due</p>
        <p class="mt-2 text-3xl font-bold text-slate-900">
          {{ formatCurrency(totalAmount) }}
        </p>
      </div>

      <!-- Payment Method Selection -->
      <div class="mb-6 space-y-3">
        <label
          class="flex cursor-pointer items-center gap-4 rounded-2xl border-2 px-4 py-3 transition"
          :class="
            paymentStore.paymentMethod === PAYMENT_METHODS.CARD
              ? 'border-blue-500 bg-blue-50'
              : 'border-slate-200 bg-white hover:border-slate-300'
          "
        >
          <input
            type="radio"
            name="payment-method"
            :value="PAYMENT_METHODS.CARD"
            :checked="paymentStore.paymentMethod === PAYMENT_METHODS.CARD"
            @change="() => handlePaymentMethodChange(PAYMENT_METHODS.CARD)"
            class="h-5 w-5 cursor-pointer text-blue-600"
          />
          <div class="flex-1">
            <p class="font-semibold text-slate-900">Credit/Debit Card</p>
            <p class="text-xs text-slate-500">Fast and secure card payment</p>
          </div>
          <svg
            class="h-5 w-5 text-blue-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M3 10h18M7 15h10m4 0a1 1 0 11-2 0 1 1 0 012 0z"
            />
          </svg>
        </label>

        <label
          class="flex cursor-pointer items-center gap-4 rounded-2xl border-2 px-4 py-3 transition"
          :class="
            paymentStore.paymentMethod === PAYMENT_METHODS.CASH
              ? 'border-green-500 bg-green-50'
              : 'border-slate-200 bg-white hover:border-slate-300'
          "
        >
          <input
            type="radio"
            name="payment-method"
            :value="PAYMENT_METHODS.CASH"
            :checked="paymentStore.paymentMethod === PAYMENT_METHODS.CASH"
            @change="() => handlePaymentMethodChange(PAYMENT_METHODS.CASH)"
            class="h-5 w-5 cursor-pointer text-green-600"
          />
          <div class="flex-1">
            <p class="font-semibold text-slate-900">Cash</p>
            <p class="text-xs text-slate-500">Receive cash and calculate change</p>
          </div>
          <svg
            class="h-5 w-5 text-green-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        </label>

        <label
          class="flex cursor-pointer items-center gap-4 rounded-2xl border-2 px-4 py-3 transition"
          :class="
            paymentStore.paymentMethod === PAYMENT_METHODS.EWALKET
              ? 'border-purple-500 bg-purple-50'
              : 'border-slate-200 bg-white hover:border-slate-300'
          "
        >
          <input
            type="radio"
            name="payment-method"
            :value="PAYMENT_METHODS.EWALKET"
            :checked="paymentStore.paymentMethod === PAYMENT_METHODS.EWALKET"
            @change="() => handlePaymentMethodChange(PAYMENT_METHODS.EWALKET)"
            class="h-5 w-5 cursor-pointer text-purple-600"
          />
          <div class="flex-1">
            <p class="font-semibold text-slate-900">E-Wallet</p>
            <p class="text-xs text-slate-500">Mobile wallet or digital payment</p>
          </div>
          <svg
            class="h-5 w-5 text-purple-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        </label>
      </div>

      <!-- Cash Input (visible when Cash is selected) -->
      <transition
        enter-active-class="transition duration-200"
        enter-from-class="opacity-0 scale-95"
        enter-to-class="opacity-100 scale-100"
        leave-active-class="transition duration-200"
        leave-from-class="opacity-100 scale-100"
        leave-to-class="opacity-0 scale-95"
      >
        <div v-if="isCash" class="mb-6 space-y-4 rounded-2xl bg-slate-50 p-4">
          <div>
            <label
              for="cash-tendered"
              class="block text-sm font-semibold text-slate-700"
              >Cash Tendered</label
            >
            <div class="relative mt-2">
              <span
                class="absolute left-4 top-1/2 -translate-y-1/2 text-lg font-semibold text-slate-500"
              >
                $
              </span>
              <input
                id="cash-tendered"
                type="number"
                :value="cashInput"
                placeholder="0.00"
                step="0.01"
                min="0"
                @input="handleCashInputChange"
                class="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 pl-8 text-lg font-semibold text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
              />
            </div>
          </div>

          <!-- Change Display -->
          <div
            v-if="paymentStore.cashTendered > 0"
            class="rounded-xl border-2 border-emerald-200 bg-emerald-50 p-3"
          >
            <div class="flex justify-between">
              <span class="text-sm font-medium text-slate-600">Change</span>
              <span class="text-lg font-bold text-emerald-700">{{
                formatCurrency(change)
              }}</span>
            </div>
          </div>

          <!-- Insufficient Payment Warning -->
          <div
            v-if="paymentStore.cashTendered > 0 && paymentStore.cashTendered < totalAmount"
            class="rounded-xl border-2 border-rose-200 bg-rose-50 p-3"
          >
            <p class="text-sm font-medium text-rose-700">
              ⚠️ Insufficient payment. Need
              {{ formatCurrency(totalAmount - paymentStore.cashTendered) }} more
            </p>
          </div>
        </div>
      </transition>

      <!-- Action Buttons -->
      <div class="grid gap-3 sm:grid-cols-2">
        <button
          @click="cancelPayment"
          class="rounded-xl border border-slate-300 bg-white px-4 py-3 font-semibold text-slate-700 transition hover:bg-slate-50"
        >
          Cancel
        </button>
        <button
          @click="confirmPayment"
          :disabled="!isValidPayment"
          class="rounded-xl bg-emerald-600 px-4 py-3 font-semibold text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Confirm Payment
        </button>
      </div>
    </div>
  </div>
</template>

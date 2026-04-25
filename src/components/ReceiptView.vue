<script setup>
import { useCurrency, useDateTime } from "../composables/useFormatters";

const props = defineProps({
  order: {
    type: Object,
    required: true,
  },
});

const { formatCurrency } = useCurrency();
const { formatDateTime } = useDateTime();

function getTaxLabel(order) {
  return order.taxRateSummary || "8%";
}

// Parse ISO string to get readable date and time
function getReceiptDate(isoString) {
  const date = new Date(isoString);
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

function getReceiptTime(isoString) {
  const date = new Date(isoString);
  return date.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function getPaymentMethodLabel(method) {
  const labels = {
    card: "Credit/Debit Card",
    cash: "Cash",
    "e-wallet": "E-Wallet",
  };
  return labels[method] || method;
}
</script>

<template>
  <div id="receipt-container" class="w-full max-w-sm mx-auto bg-white p-8 font-mono text-sm">
    <!-- Receipt Header -->
    <div class="text-center mb-6 border-b-2 border-slate-300 pb-4">
      <h1 class="text-2xl font-bold text-slate-900">RECEIPT</h1>
      <p class="text-xs text-slate-600 mt-1">Transaction #{{ order.orderNumber }}</p>
    </div>

    <!-- Date & Time -->
    <div class="text-center mb-6 text-xs text-slate-600">
      <p>{{ getReceiptDate(order.checkedOutAt) }} {{ getReceiptTime(order.checkedOutAt) }}</p>
    </div>

    <!-- Items Section -->
    <div class="mb-6 border-b border-slate-300 pb-4">
      <table class="w-full text-xs">
        <thead>
          <tr class="border-b border-slate-300 pb-2 mb-2">
            <th class="text-left font-bold py-1">Item</th>
            <th class="text-center font-bold py-1">Qty</th>
            <th class="text-right font-bold py-1">Price</th>
            <th class="text-right font-bold py-1">Total</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-200">
          <tr v-for="item in order.items" :key="item.productId" class="py-2">
            <td class="text-left text-slate-900 font-medium">{{ item.name }}</td>
            <td class="text-center text-slate-700">{{ item.quantity }}</td>
            <td class="text-right text-slate-700">{{ formatCurrency(item.price) }}</td>
            <td class="text-right font-semibold text-slate-900">{{ formatCurrency(item.quantity * item.price) }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Summary Section -->
    <div class="space-y-2 mb-6 border-b border-slate-300 pb-4">
      <div class="flex justify-between text-xs text-slate-600">
        <span>Subtotal:</span>
        <span>{{ formatCurrency(order.subtotal) }}</span>
      </div>

      <div v-if="order.coupon" class="flex justify-between text-xs text-emerald-600 font-medium">
        <span>Discount ({{ order.coupon.code }}):</span>
        <span>-{{ formatCurrency(order.discount) }}</span>
      </div>

      <div class="flex justify-between text-xs text-slate-600">
        <span>Tax ({{ getTaxLabel(order) }}):</span>
        <span>{{ formatCurrency(order.tax) }}</span>
      </div>

      <div class="flex justify-between text-sm font-bold text-slate-900 pt-2">
        <span>TOTAL:</span>
        <span>{{ formatCurrency(order.total) }}</span>
      </div>
    </div>

    <!-- Payment Information -->
    <div class="space-y-2 mb-6 border-b border-slate-300 pb-4">
      <p class="text-xs font-bold uppercase text-slate-600 tracking-wide">Payment Details</p>
      <div class="flex justify-between text-xs text-slate-700">
        <span>Payment Method:</span>
        <span class="font-semibold">{{ getPaymentMethodLabel(order.payment.paymentMethod) }}</span>
      </div>

      <div v-if="order.payment.paymentMethod === 'cash'" class="space-y-1 bg-slate-50 p-2 rounded">
        <div class="flex justify-between text-xs text-slate-700">
          <span>Amount Tendered:</span>
          <span class="font-semibold">{{ formatCurrency(order.payment.cashTendered) }}</span>
        </div>
        <div class="flex justify-between text-xs font-bold text-emerald-700">
          <span>Change:</span>
          <span>{{ formatCurrency(order.payment.change) }}</span>
        </div>
      </div>
    </div>

    <!-- Footer -->
    <div class="text-center space-y-2 text-xs text-slate-600">
      <p class="font-semibold text-slate-900 text-sm">Thank you for your purchase!</p>
      <p>{{ order.itemCount }} item{{ order.itemCount !== 1 ? "s" : "" }} purchased</p>
      <div class="pt-2 border-t border-slate-300 mt-4">
        <p class="text-slate-500">Please come again!</p>
      </div>
    </div>

    <!-- Print only footer -->
    <div class="hidden print:block text-center text-xs text-slate-400 mt-6 pt-4 border-t border-slate-300">
      <p>{{ new Date().toLocaleString() }}</p>
    </div>
  </div>
</template>

<style scoped>
#receipt-container {
  width: 80mm;
  max-width: 100%;
}

@media print {
  #receipt-container {
    width: 80mm;
    max-width: 100%;
    margin: 0;
    padding: 4mm;
    background: white;
  }

  :global(body) {
    margin: 0;
    padding: 0;
  }
}
</style>

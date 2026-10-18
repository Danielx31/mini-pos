<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import AppNavbar from "../components/AppNavbar.vue";
import { useCurrency, useDateTime } from "../composables/useFormatters";
import { ROUTE_NAMES } from "../constants/routes";
import { api } from "../lib/api";
import { useOrdersStore } from "../stores/orders";
import { fromCents, toCents } from "../../shared/money.js";

type CreditItem = { productId: string; name: string; quantity: number; price: number; lineTotal: number };
type CreditSale = {
  kind: "sale";
  orderNumber: string;
  checkedOutAt: string;
  customerName: string;
  customerContact: string | null;
  dueDate: string | null;
  total: number;
  paid: number;
  balance: number;
  status: "unpaid" | "partial" | "paid" | "refunded";
  archived: boolean;
  items: CreditItem[];
};
type OpeningCredit = {
  kind: "opening";
  id: string;
  customerName: string;
  customerContact: string | null;
  itemDetails: string | null;
  priorDate: string | null;
  recordedAt: string;
  total: number;
  paid: number;
  balance: number;
  status: "unpaid" | "partial" | "paid";
  payments: { id: string; amount: number; note: string | null; receivedAt: string; receivedBy: string }[];
};
type CreditRecord = CreditSale | OpeningCredit;
type CustomerCredit = {
  key: string;
  name: string;
  contact: string | null;
  records: CreditRecord[];
  total: number;
  paid: number;
  balance: number;
};

const router = useRouter();
const ordersStore = useOrdersStore();
const { formatCurrency } = useCurrency();
const { formatDateTime } = useDateTime();
const creditSales = ref<CreditSale[]>([]);
const openingCredits = ref<OpeningCredit[]>([]);
const search = ref("");
const statusFilter = ref("open");
const loading = ref(false);
const error = ref("");
const entryName = ref("");
const entryContact = ref("");
const entryDetails = ref("");
const entryDate = ref("");
const entryAmount = ref("");
const entryKey = ref(crypto.randomUUID());
const entrySaving = ref(false);
const entryNotice = ref("");
const entryError = ref(false);
const paymentAmounts = ref<Record<string, string>>({});
const paymentNotes = ref<Record<string, string>>({});
const paymentKeys = ref<Record<string, string>>({});
const paymentSaving = ref("");
const paymentNotice = ref("");
const paymentError = ref(false);

function matchesRecord(record: CreditRecord) {
  const term = search.value.trim().toLowerCase();
  const matchesStatus = statusFilter.value === "all" ||
    (statusFilter.value === "open" ? record.balance > 0 && record.status !== "refunded" : record.status === statusFilter.value);
  const searchable = record.kind === "sale"
    ? [record.customerName, record.customerContact, record.orderNumber, ...record.items.map((item) => item.name)]
    : [record.customerName, record.customerContact, record.itemDetails, record.priorDate];
  const matchesSearch = !term || searchable
    .some((value) => value?.toLowerCase().includes(term));
  return matchesStatus && matchesSearch;
}

const filteredSales = computed(() => creditSales.value.filter(matchesRecord));
const allRecords = computed<CreditRecord[]>(() => [...creditSales.value, ...openingCredits.value]);
const customerCredits = computed(() => {
  const groups = new Map<string, CustomerCredit>();
  for (const record of allRecords.value) {
    const key = JSON.stringify([record.customerName.trim().toLowerCase(), record.customerContact?.trim().toLowerCase() || ""]);
    let customer = groups.get(key);
    if (!customer) {
      customer = { key, name: record.customerName, contact: record.customerContact, records: [], total: 0, paid: 0, balance: 0 };
      groups.set(key, customer);
    }
    customer.records.push(record);
    if (record.status !== "refunded") {
      customer.total = fromCents(toCents(customer.total) + toCents(record.total));
      customer.paid = fromCents(toCents(customer.paid) + toCents(record.paid));
      customer.balance = fromCents(toCents(customer.balance) + toCents(record.balance));
    }
  }
  return [...groups.values()].sort((a, b) => b.balance - a.balance || a.name.localeCompare(b.name));
});
const visibleCustomerCredits = computed(() => customerCredits.value.filter((customer) => customer.records.some(matchesRecord)));

const activeRecords = computed(() => allRecords.value.filter((record) => record.status !== "refunded"));
const totalCredit = computed(() => fromCents(activeRecords.value.reduce((sum, record) => sum + toCents(record.total), 0)));
const totalPaid = computed(() => fromCents(activeRecords.value.reduce((sum, record) => sum + toCents(record.paid), 0)));
const totalOutstanding = computed(() => fromCents(activeRecords.value.reduce((sum, record) => sum + toCents(record.balance), 0)));
const filteredOpeningCredits = computed(() => openingCredits.value.filter(matchesRecord));

function statusLabel(status: CreditSale["status"]) {
  return { unpaid: "Unpaid", partial: "Partly paid", paid: "Paid", refunded: "Refunded" }[status];
}

function statusClass(status: CreditSale["status"]) {
  return {
    unpaid: "bg-amber-100 text-amber-900",
    partial: "bg-blue-100 text-blue-800",
    paid: "bg-emerald-100 text-emerald-800",
    refunded: "bg-slate-100 text-slate-700",
  }[status];
}

async function loadSales() {
  loading.value = true;
  error.value = "";
  try {
    const [sales, openings] = await Promise.all([api("/credit-sales"), api("/opening-credits")]);
    creditSales.value = (sales as Omit<CreditSale, "kind">[]).map((sale) => ({ ...sale, kind: "sale" }));
    openingCredits.value = (openings as Omit<OpeningCredit, "kind">[]).map((credit) => ({ ...credit, kind: "opening" }));
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : "Could not load utang sales.";
  } finally {
    loading.value = false;
  }
}

async function saveOpeningCredit() {
  if (entrySaving.value) return;
  entrySaving.value = true;
  entryNotice.value = "";
  entryError.value = false;
  try {
    const result = await api("/opening-credits", {
      method: "POST",
      body: {
        entryKey: entryKey.value, customerName: entryName.value, customerContact: entryContact.value,
        itemDetails: entryDetails.value, priorDate: entryDate.value, amount: entryAmount.value,
      },
    }) as { message: string; openingCredits: Omit<OpeningCredit, "kind">[] };
    openingCredits.value = result.openingCredits.map((credit) => ({ ...credit, kind: "opening" }));
    entryNotice.value = result.message;
    entryName.value = "";
    entryContact.value = "";
    entryDetails.value = "";
    entryDate.value = "";
    entryAmount.value = "";
    entryKey.value = crypto.randomUUID();
  } catch (cause) {
    entryError.value = true;
    entryNotice.value = cause instanceof Error ? cause.message : "Could not save opening balance.";
  } finally {
    entrySaving.value = false;
  }
}

async function recordOpeningPayment(credit: OpeningCredit) {
  if (paymentSaving.value) return;
  paymentSaving.value = credit.id;
  paymentNotice.value = "";
  paymentError.value = false;
  paymentKeys.value[credit.id] ||= crypto.randomUUID();
  try {
    const result = await api(`/opening-credits/${encodeURIComponent(credit.id)}/payments`, {
      method: "POST",
      body: { paymentKey: paymentKeys.value[credit.id], amount: paymentAmounts.value[credit.id], note: paymentNotes.value[credit.id] || "" },
    }) as { message: string; openingCredits: Omit<OpeningCredit, "kind">[] };
    openingCredits.value = result.openingCredits.map((item) => ({ ...item, kind: "opening" }));
    paymentNotice.value = result.message;
    paymentAmounts.value[credit.id] = "";
    paymentNotes.value[credit.id] = "";
    paymentKeys.value[credit.id] = crypto.randomUUID();
  } catch (cause) {
    paymentError.value = true;
    paymentNotice.value = cause instanceof Error ? cause.message : "Could not record repayment.";
  } finally {
    paymentSaving.value = "";
  }
}

function openOrder(sale: CreditSale) {
  ordersStore.searchTerm = sale.orderNumber;
  ordersStore.dateFilter = "";
  router.push({ name: ROUTE_NAMES.ORDERS });
}

onMounted(loadSales);
</script>

<template>
  <div class="min-h-screen bg-slate-50">
    <AppNavbar show-back />
    <main class="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div class="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p class="text-sm font-semibold uppercase tracking-wide text-amber-700">Customer credit</p>
          <h2 class="mt-1 text-3xl font-bold text-slate-950">Utang list</h2>
          <p class="mt-2 max-w-2xl text-sm text-slate-600">See current utang sales and credit carried over from before Mini POS. Select a customer to review what is owed and what has been paid.</p>
        </div>
        <button type="button" :disabled="loading" class="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-100 disabled:opacity-50" @click="loadSales">{{ loading ? 'Loading...' : 'Refresh list' }}</button>
      </div>

      <div class="mb-6 grid gap-4 sm:grid-cols-3">
        <div class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p class="text-sm text-slate-600">Total credit recorded</p>
          <p class="mt-1 text-2xl font-bold text-slate-950">{{ formatCurrency(totalCredit) }}</p>
        </div>
        <div class="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 shadow-sm">
          <p class="text-sm text-emerald-800">Cash repayments recorded</p>
          <p class="mt-1 text-2xl font-bold text-emerald-950">{{ formatCurrency(totalPaid) }}</p>
        </div>
        <div class="rounded-2xl border border-amber-200 bg-amber-50 p-5 shadow-sm">
          <p class="text-sm text-amber-800">Still owed</p>
          <p class="mt-1 text-2xl font-bold text-amber-950">{{ formatCurrency(totalOutstanding) }}</p>
        </div>
      </div>

      <section aria-labelledby="opening-credit-heading" class="mb-6 rounded-2xl border border-amber-200 bg-white p-5 shadow-sm">
        <h3 id="opening-credit-heading" class="text-lg font-bold text-slate-950">Add credit from before Mini POS</h3>
        <p class="mt-1 text-sm text-slate-600">Enter only the balance the customer still owes today. This adds to their utang total without creating a sale or changing stock.</p>
        <form class="mt-4 grid gap-4 sm:grid-cols-2" @submit.prevent="saveOpeningCredit">
          <div>
            <label for="opening-name" class="mb-1 block text-sm font-medium text-slate-800">Customer name *</label>
            <input id="opening-name" v-model="entryName" type="text" maxlength="100" required autocomplete="off" class="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-slate-950 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-100" placeholder="Use the same name as future utang sales" />
          </div>
          <div>
            <label for="opening-contact" class="mb-1 block text-sm font-medium text-slate-800">Contact (optional)</label>
            <input id="opening-contact" v-model="entryContact" type="text" maxlength="100" autocomplete="off" class="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-slate-950 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-100" placeholder="Use the same contact as future sales" />
          </div>
          <div>
            <label for="opening-amount" class="mb-1 block text-sm font-medium text-slate-800">Amount still owed (₱) *</label>
            <input id="opening-amount" v-model="entryAmount" type="number" min="0.01" max="1000000" step="0.01" required class="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-slate-950 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-100" placeholder="0.00" />
          </div>
          <div>
            <label for="opening-date" class="mb-1 block text-sm font-medium text-slate-800">Original credit date (optional)</label>
            <input id="opening-date" v-model="entryDate" type="date" class="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-slate-950 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-100" />
          </div>
          <div class="sm:col-span-2">
            <label for="opening-details" class="mb-1 block text-sm font-medium text-slate-800">Items or reason (optional)</label>
            <textarea id="opening-details" v-model="entryDetails" maxlength="500" rows="2" class="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-slate-950 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-100" placeholder="For example: 2 bags of rice and 1 bottle of cooking oil"></textarea>
          </div>
          <div class="flex flex-wrap items-center gap-3 sm:col-span-2">
            <button type="submit" :disabled="entrySaving" class="rounded-xl bg-amber-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-50">{{ entrySaving ? 'Saving...' : 'Add old credit' }}</button>
            <p v-if="entryNotice" role="status" aria-live="polite" class="text-sm" :class="entryError ? 'text-rose-700' : 'text-emerald-800'">{{ entryNotice }}</p>
          </div>
        </form>
      </section>

      <div class="mb-4 grid gap-3 sm:grid-cols-[1fr_180px]">
        <div>
          <label for="credit-search" class="mb-1 block text-sm font-medium text-slate-700">Search customer, order, or item</label>
          <input id="credit-search" v-model="search" type="search" class="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-slate-900 placeholder:text-slate-400 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-100" placeholder="Enter a name, contact, order, or item" />
        </div>
        <div>
          <label for="credit-status" class="mb-1 block text-sm font-medium text-slate-700">Status</label>
          <select id="credit-status" v-model="statusFilter" class="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-slate-900 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-100">
            <option value="open">Open balances</option>
            <option value="all">All credit records</option>
            <option value="unpaid">Unpaid</option>
            <option value="partial">Partly paid</option>
            <option value="paid">Paid</option>
            <option value="refunded">Refunded</option>
          </select>
        </div>
      </div>

      <p v-if="error" role="alert" class="mb-4 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">{{ error }}</p>
      <section aria-labelledby="customer-credit-heading" class="mb-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div class="border-b border-slate-200 px-5 py-4">
          <h3 id="customer-credit-heading" class="text-lg font-bold text-slate-950">Credit by customer</h3>
          <p class="mt-1 text-sm text-slate-600">Select a name to see POS utang purchases and older credit balances. Totals include paid and open records; refunded sales are excluded.</p>
          <p class="mt-1 text-xs text-slate-500">Records are grouped by matching customer name and contact. Use the same details each time to keep a customer's credit together.</p>
        </div>
        <div class="divide-y divide-slate-200">
          <details v-for="customer in visibleCustomerCredits" :key="customer.key" class="group">
            <summary class="cursor-pointer list-none px-5 py-4 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-amber-600 [&::-webkit-details-marker]:hidden">
              <span class="flex flex-wrap items-center gap-x-6 gap-y-3">
                <span class="min-w-48 flex-1">
                  <span class="block font-semibold text-slate-950">{{ customer.name }}</span>
                  <span v-if="customer.contact" class="block text-xs text-slate-600">{{ customer.contact }}</span>
                  <span class="block text-xs text-slate-500">{{ customer.records.length }} {{ customer.records.length === 1 ? 'credit record' : 'credit records' }} · View details <span aria-hidden="true" class="inline-block transition-transform group-open:rotate-90">›</span></span>
                </span>
                <span class="grid min-w-64 flex-1 grid-cols-3 gap-3 text-right text-xs sm:text-sm">
                  <span><span class="block text-slate-500">Overall total</span><strong class="block text-slate-950">{{ formatCurrency(customer.total) }}</strong></span>
                  <span><span class="block text-slate-500">Paid</span><strong class="block text-emerald-800">{{ formatCurrency(customer.paid) }}</strong></span>
                  <span><span class="block text-slate-500">Owed</span><strong class="block text-amber-900">{{ formatCurrency(customer.balance) }}</strong></span>
                </span>
              </span>
            </summary>
            <div class="border-t border-slate-100 bg-slate-50 px-5 py-4">
              <div class="space-y-4">
                <div v-for="record in customer.records" :key="record.kind === 'sale' ? record.orderNumber : record.id" class="rounded-xl border border-slate-200 bg-white p-4">
                  <div class="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p v-if="record.kind === 'sale'" class="font-mono text-xs font-semibold text-slate-700">POS sale {{ record.orderNumber }}</p>
                      <p v-else class="text-xs font-semibold uppercase tracking-wide text-amber-800">Credit from before Mini POS</p>
                      <p class="mt-1 text-xs text-slate-500">{{ record.kind === 'sale' ? formatDateTime(record.checkedOutAt) : `Recorded ${formatDateTime(record.recordedAt)}` }}</p>
                      <p v-if="record.kind === 'opening' && record.priorDate" class="text-xs text-slate-500">Original date: {{ record.priorDate }}</p>
                    </div>
                    <span class="inline-flex rounded-full px-2.5 py-1 text-xs font-semibold" :class="statusClass(record.status)">{{ statusLabel(record.status) }}</span>
                  </div>
                  <ul v-if="record.kind === 'sale'" class="mt-3 divide-y divide-slate-100 border-y border-slate-100">
                    <li v-for="(item, index) in record.items" :key="`${item.productId}-${index}`" class="flex flex-wrap justify-between gap-x-4 gap-y-1 py-2 text-sm">
                      <span class="font-medium text-slate-900">{{ item.name }} <span class="font-normal text-slate-600">× {{ item.quantity }}</span></span>
                      <span class="text-slate-700">{{ formatCurrency(item.price) }} each · {{ formatCurrency(item.lineTotal) }}</span>
                    </li>
                  </ul>
                  <p v-else class="mt-3 whitespace-pre-wrap border-y border-slate-100 py-3 text-sm text-slate-800">{{ record.itemDetails || 'No item details were recorded for this older balance.' }}</p>
                  <div class="mt-3 flex flex-wrap items-center justify-between gap-3 text-sm">
                    <span class="text-slate-600">{{ record.kind === 'sale' ? 'Sale total' : 'Opening balance' }} <strong class="text-slate-950">{{ formatCurrency(record.total) }}</strong> · Paid <strong class="text-emerald-800">{{ formatCurrency(record.paid) }}</strong> · Owed <strong class="text-amber-900">{{ formatCurrency(record.balance) }}</strong></span>
                    <button v-if="record.kind === 'sale' && !record.archived && record.balance > 0 && record.status !== 'refunded'" type="button" class="rounded-lg border border-amber-300 px-3 py-1.5 text-xs font-semibold text-amber-900 hover:bg-amber-50" @click="openOrder(record)">Record payment</button>
                  </div>
                  <template v-if="record.kind === 'opening'">
                    <form v-if="record.balance > 0" class="mt-4 grid gap-3 border-t border-slate-100 pt-4 sm:grid-cols-[1fr_1fr_auto]" @submit.prevent="recordOpeningPayment(record)">
                      <div>
                        <label :for="`opening-payment-${record.id}`" class="mb-1 block text-xs font-semibold text-slate-700">Cash received (₱)</label>
                        <input :id="`opening-payment-${record.id}`" v-model="paymentAmounts[record.id]" type="number" min="0.01" step="0.01" :max="record.balance" required class="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-950 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-100" placeholder="0.00" />
                      </div>
                      <div>
                        <label :for="`opening-note-${record.id}`" class="mb-1 block text-xs font-semibold text-slate-700">Payment note (optional)</label>
                        <input :id="`opening-note-${record.id}`" v-model="paymentNotes[record.id]" type="text" maxlength="200" class="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-950 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-100" placeholder="Reference or note" />
                      </div>
                      <button type="submit" :disabled="Boolean(paymentSaving)" class="self-end rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-50">{{ paymentSaving === record.id ? 'Saving...' : 'Record cash' }}</button>
                    </form>
                    <div v-if="record.payments.length" class="mt-4 border-t border-slate-100 pt-3">
                      <p class="text-xs font-semibold uppercase tracking-wide text-slate-600">Repayments recorded here</p>
                      <ul class="mt-2 space-y-1 text-xs text-slate-700">
                        <li v-for="payment in record.payments" :key="payment.id">{{ formatCurrency(payment.amount) }} · {{ formatDateTime(payment.receivedAt) }} · {{ payment.receivedBy }}<span v-if="payment.note"> · {{ payment.note }}</span></li>
                      </ul>
                    </div>
                  </template>
                </div>
              </div>
            </div>
          </details>
        </div>
        <p v-if="!loading && visibleCustomerCredits.length === 0" class="px-5 py-10 text-center text-sm text-slate-600">{{ allRecords.length === 0 ? 'No utang customers yet.' : 'No customers match these filters.' }}</p>
      </section>

      <p v-if="paymentNotice" role="status" aria-live="polite" class="mb-4 rounded-xl border px-4 py-3 text-sm" :class="paymentError ? 'border-rose-200 bg-rose-50 text-rose-800' : 'border-emerald-200 bg-emerald-50 text-emerald-900'">{{ paymentNotice }}</p>

      <section v-if="filteredOpeningCredits.length" aria-labelledby="older-credit-heading" class="mb-6 rounded-2xl border border-amber-200 bg-amber-50 p-5">
        <h3 id="older-credit-heading" class="font-bold text-amber-950">Older credit balances</h3>
        <p class="mt-1 text-sm text-amber-900">{{ filteredOpeningCredits.length }} {{ filteredOpeningCredits.length === 1 ? 'balance' : 'balances' }} included in the totals above. Select a customer to view items and record cash repayment.</p>
      </section>

      <div class="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <p class="border-b border-slate-200 px-5 py-3 text-sm text-slate-600">{{ filteredSales.length }} {{ filteredSales.length === 1 ? 'sale' : 'sales' }} shown. Product prices are from the sale; totals include tax and discounts.</p>
        <div class="overflow-x-auto">
          <table class="w-full min-w-[1080px] text-left text-sm">
            <thead class="bg-slate-50 text-xs uppercase tracking-wide text-slate-600">
              <tr>
                <th scope="col" class="px-5 py-3">Customer and order</th>
                <th scope="col" class="px-5 py-3">Items and prices</th>
                <th scope="col" class="px-5 py-3 text-right">Total</th>
                <th scope="col" class="px-5 py-3 text-right">Cash recorded</th>
                <th scope="col" class="px-5 py-3 text-right">Balance</th>
                <th scope="col" class="px-5 py-3">Due date</th>
                <th scope="col" class="px-5 py-3">Status</th>
                <th scope="col" class="px-5 py-3">Action</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-200">
              <tr v-for="sale in filteredSales" :key="sale.orderNumber" class="align-top">
                <td class="px-5 py-4">
                  <p class="font-semibold text-slate-950">{{ sale.customerName }}</p>
                  <p v-if="sale.customerContact" class="text-xs text-slate-600">{{ sale.customerContact }}</p>
                  <p class="mt-1 font-mono text-xs text-slate-600">{{ sale.orderNumber }}</p>
                  <p class="text-xs text-slate-500">{{ formatDateTime(sale.checkedOutAt) }}</p>
                </td>
                <td class="px-5 py-4">
                  <ul class="space-y-2">
                    <li v-for="item in sale.items" :key="item.productId" class="text-slate-800">
                      <span class="font-medium">{{ item.name }}</span>
                      <span class="block text-xs text-slate-600">{{ item.quantity }} × {{ formatCurrency(item.price) }} = {{ formatCurrency(item.lineTotal) }}</span>
                    </li>
                  </ul>
                </td>
                <td class="px-5 py-4 text-right font-semibold text-slate-950">{{ formatCurrency(sale.total) }}</td>
                <td class="px-5 py-4 text-right text-emerald-800">{{ formatCurrency(sale.paid) }}</td>
                <td class="px-5 py-4 text-right font-bold text-amber-900">{{ formatCurrency(sale.balance) }}</td>
                <td class="px-5 py-4 text-slate-700">{{ sale.dueDate || '—' }}</td>
                <td class="px-5 py-4"><span class="inline-flex rounded-full px-2.5 py-1 text-xs font-semibold" :class="statusClass(sale.status)">{{ statusLabel(sale.status) }}</span></td>
                <td class="px-5 py-4">
                  <button v-if="!sale.archived && sale.balance > 0" type="button" class="whitespace-nowrap rounded-lg border border-amber-300 px-3 py-1.5 text-xs font-semibold text-amber-900 hover:bg-amber-50" @click="openOrder(sale)">Record payment</button>
                  <span v-else class="text-xs text-slate-500">{{ sale.archived ? 'Archived order' : '—' }}</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <p v-if="!loading && filteredSales.length === 0" class="px-5 py-12 text-center text-sm text-slate-600">{{ creditSales.length === 0 ? 'No utang sales yet.' : 'No sales match these filters.' }}</p>
      </div>
      <p class="mt-4 text-xs text-slate-500">Refunded sales remain visible for audit. Cash already collected for a refunded sale must be returned outside Mini POS.</p>
    </main>
  </div>
</template>

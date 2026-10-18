import { computed, ref } from "vue";
import { defineStore } from "pinia";
import { api } from "../lib/api";
import { useAuthStore } from "./auth";
import { useProductsStore } from "./products";

export const useOrdersStore = defineStore("orders", () => {
  const orders = ref([]);
  const searchTerm = ref("");
  const dateFilter = ref("");
  const filteredOrders = computed(() => orders.value.filter((order) => {
    const search = searchTerm.value.trim().toLowerCase();
    return (!search || order.orderNumber.toLowerCase().includes(search) || order.items.some((item) => item.name.toLowerCase().includes(search)) || order.credit?.customerName.toLowerCase().includes(search) || order.credit?.customerContact?.toLowerCase().includes(search)) &&
      (!dateFilter.value || order.checkedOutAt.slice(0, 10) === dateFilter.value);
  }));
  const totalOrders = computed(() => orders.value.length);
  const totalRevenue = computed(() => orders.value.filter((order) => !order.refunded).reduce((sum, order) => sum + order.total, 0));
  const outstandingCredit = computed(() => orders.value.filter((order) => !order.refunded).reduce((sum, order) => sum + (order.credit?.balance ?? 0), 0));
  const totalItemsSold = computed(() => orders.value.filter((order) => !order.refunded).reduce((sum, order) => sum + order.itemCount, 0));

  function addOrder(order) { orders.value.unshift(order); }
  async function clearHistory() {
    try {
      const result = await api("/orders", { method: "DELETE" });
      orders.value = result.orders;
      return result;
    } catch (error) { return { ok: false, message: error.message }; }
  }
  function clearFilters() { searchTerm.value = ""; dateFilter.value = ""; }
  async function refundOrder(orderNumber) {
    if (!useAuthStore().canManage) return { ok: false, message: "Manager or administrator access required to record refunds." };
    try {
      const result = await api(`/orders/${encodeURIComponent(orderNumber)}/refund`, { method: "POST" });
      orders.value = result.orders;
      useProductsStore().products = result.products;
      return result;
    } catch (error) { return { ok: false, message: error.message }; }
  }
  async function loadCreditPayments(orderNumber) {
    return api(`/orders/${encodeURIComponent(orderNumber)}/credit-payments`);
  }
  async function recordCreditPayment(orderNumber, payment) {
    try {
      const result = await api(`/orders/${encodeURIComponent(orderNumber)}/credit-payments`, { method: "POST", body: payment });
      orders.value = result.orders;
      return result;
    } catch (error) { return { ok: false, message: error.message }; }
  }
  return { orders, searchTerm, dateFilter, filteredOrders, totalOrders, totalRevenue, outstandingCredit, totalItemsSold, addOrder, clearHistory, clearFilters, refundOrder, loadCreditPayments, recordCreditPayment };
});

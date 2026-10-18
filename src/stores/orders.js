import { computed, ref } from "vue";
import { defineStore } from "pinia";
import { api } from "../lib/api";
import { useProductsStore } from "./products";

export const useOrdersStore = defineStore("orders", () => {
  const orders = ref([]);
  const searchTerm = ref("");
  const dateFilter = ref("");
  const filteredOrders = computed(() => orders.value.filter((order) => {
    const search = searchTerm.value.trim().toLowerCase();
    return (!search || order.orderNumber.toLowerCase().includes(search) || order.items.some((item) => item.name.toLowerCase().includes(search))) &&
      (!dateFilter.value || order.checkedOutAt.slice(0, 10) === dateFilter.value);
  }));
  const totalOrders = computed(() => orders.value.length);
  const totalRevenue = computed(() => orders.value.filter((order) => !order.refunded).reduce((sum, order) => sum + order.total, 0));
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
    try {
      const result = await api(`/orders/${encodeURIComponent(orderNumber)}/refund`, { method: "POST" });
      orders.value = result.orders;
      useProductsStore().products = result.products;
      return result;
    } catch (error) { return { ok: false, message: error.message }; }
  }
  return { orders, searchTerm, dateFilter, filteredOrders, totalOrders, totalRevenue, totalItemsSold, addOrder, clearHistory, clearFilters, refundOrder };
});

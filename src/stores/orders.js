import { computed, ref } from "vue";
import { defineStore } from "pinia";

const STORAGE_KEY = "mini_pos_orders";

export const useOrdersStore = defineStore("orders", () => {
  const orders = ref(loadOrdersFromStorage());
  const searchTerm = ref("");
  const dateFilter = ref("");

  const filteredOrders = computed(() => {
    let result = orders.value;

    const normalizedSearch = searchTerm.value.trim().toLowerCase();
    if (normalizedSearch) {
      result = result.filter((order) => {
        const matchesOrderNumber = order.orderNumber
          .toLowerCase()
          .includes(normalizedSearch);
        const matchesItems = order.items.some((item) =>
          item.name.toLowerCase().includes(normalizedSearch),
        );
        return matchesOrderNumber || matchesItems;
      });
    }

    if (dateFilter.value) {
      result = result.filter((order) => {
        const orderDate = order.checkedOutAt.substring(0, 10);
        return orderDate === dateFilter.value;
      });
    }

    return result;
  });

  const totalOrders = computed(() => orders.value.length);

  const totalRevenue = computed(() => {
    return orders.value.reduce((sum, order) => sum + order.total, 0);
  });

  const totalItemsSold = computed(() => {
    return orders.value.reduce((sum, order) => sum + order.itemCount, 0);
  });

  function loadOrdersFromStorage() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  }

  function saveOrdersToStorage() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(orders.value));
  }

  function addOrder(orderSummary) {
    orders.value.unshift(orderSummary);
    saveOrdersToStorage();
  }

  function clearHistory() {
    orders.value = [];
    saveOrdersToStorage();
  }

  function clearFilters() {
    searchTerm.value = "";
    dateFilter.value = "";
  }

  return {
    orders,
    searchTerm,
    dateFilter,
    filteredOrders,
    totalOrders,
    totalRevenue,
    totalItemsSold,
    addOrder,
    clearHistory,
    clearFilters,
  };
});

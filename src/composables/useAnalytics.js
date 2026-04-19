import { computed } from "vue";

/**
 * Analytics composable for sales data aggregation and reporting
 * Provides methods to calculate revenue, top products, and peak hours
 */
export const useAnalytics = (orders) => {
  const source = computed(() => (Array.isArray(orders) ? orders : orders.value ?? []));

  // Daily revenue data
  const dailyRevenue = computed(() => {
    const byDate = {};

    source.value.forEach((order) => {
      const date = order.checkedOutAt.substring(0, 10); // YYYY-MM-DD
      if (!byDate[date]) {
        byDate[date] = { date, revenue: 0, count: 0 };
      }
      byDate[date].revenue += order.total;
      byDate[date].count += 1;
    });

    return Object.values(byDate).sort((a, b) => a.date.localeCompare(b.date));
  });

  // Weekly revenue data (last 12 weeks)
  const weeklyRevenue = computed(() => {
    const byWeek = {};

    orders.forEach((order) => {
      const date = new Date(order.checkedOutAt);
      const weekStart = new Date(date);
      weekStart.setDate(date.getDate() - date.getDay()); // Start of week (Sunday)
      const weekKey = weekStart.toISOString().substring(0, 10);

      if (!byWeek[weekKey]) {
        byWeek[weekKey] = { weekStart: weekKey, revenue: 0, count: 0 };
      }
      byWeek[weekKey].revenue += order.total;
      byWeek[weekKey].count += 1;
    });

    return Object.values(byWeek).sort((a, b) => a.weekStart.localeCompare(b.weekStart)).slice(-12);
  });

  // Monthly revenue data (last 12 months)
  const monthlyRevenue = computed(() => {
    const byMonth = {};

    orders.forEach((order) => {
      const month = order.checkedOutAt.substring(0, 7); // YYYY-MM
      if (!byMonth[month]) {
        byMonth[month] = { month, revenue: 0, count: 0 };
      }
      byMonth[month].revenue += order.total;
      byMonth[month].count += 1;
    });

    return Object.values(byMonth).sort((a, b) => a.month.localeCompare(b.month)).slice(-12);
  });

  // Top selling products
  const topSellingProducts = computed(() => {
    const productSales = {};

    orders.forEach((order) => {
      order.items.forEach((item) => {
        if (!productSales[item.name]) {
          productSales[item.name] = {
            name: item.name,
            quantity: 0,
            revenue: 0,
          };
        }
        productSales[item.name].quantity += item.quantity;
        productSales[item.name].revenue += item.subtotal || item.price * item.quantity;
      });
    });

    return Object.values(productSales)
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 10);
  });

  // Peak hours analysis (by hour of day)
  const peakHours = computed(() => {
    const byHour = {};

    for (let i = 0; i < 24; i++) {
      byHour[i] = { hour: `${String(i).padStart(2, "0")}:00`, revenue: 0, count: 0 };
    }

    source.value.forEach((order) => {
      const hour = parseInt(order.checkedOutAt.substring(11, 13), 10);
      byHour[hour].revenue += order.total;
      byHour[hour].count += 1;
    });

    return Object.values(byHour);
  });

  // Summary statistics
  const analytics = computed(() => {
    const totalRevenue = source.value.reduce((sum, order) => sum + order.total, 0);
    const totalOrders = source.value.length;
    const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

    // Get today's date range
    const today = new Date();
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString().substring(0, 10);
    const todayRevenue = source.value
      .filter((order) => order.checkedOutAt.substring(0, 10) === todayStart)
      .reduce((sum, order) => sum + order.total, 0);

    // Get this week's date range
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - today.getDay());
    const weekStartKey = weekStart.toISOString().substring(0, 10);
    const thisWeekRevenue = source.value
      .filter((order) => order.checkedOutAt.substring(0, 10) >= weekStartKey)
      .reduce((sum, order) => sum + order.total, 0);

    // Get this month's date range
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().substring(0, 7);
    const thisMonthRevenue = source.value
      .filter((order) => order.checkedOutAt.substring(0, 7) === monthStart)
      .reduce((sum, order) => sum + order.total, 0);

    return {
      totalRevenue: Math.round(totalRevenue * 100) / 100,
      totalOrders,
      averageOrderValue: Math.round(averageOrderValue * 100) / 100,
      todayRevenue: Math.round(todayRevenue * 100) / 100,
      thisWeekRevenue: Math.round(thisWeekRevenue * 100) / 100,
      thisMonthRevenue: Math.round(thisMonthRevenue * 100) / 100,
    };
  });

  return {
    dailyRevenue,
    weeklyRevenue,
    monthlyRevenue,
    topSellingProducts,
    peakHours,
    analytics,
  };
};

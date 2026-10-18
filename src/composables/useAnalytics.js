import { computed } from "vue";
import { fromCents, toCents } from "../../shared/money.js";

/**
 * Analytics composable for sales data aggregation and reporting
 * Provides methods to calculate revenue, top products, and peak hours
 */
export const useAnalytics = (orders) => {
  const source = computed(() => {
    const current = typeof orders === "function" ? orders() : Array.isArray(orders) ? orders : orders.value ?? [];
    return current.filter((order) => !order.refunded);
  });

  // Daily revenue data
  const dailyRevenue = computed(() => {
    const byDate = {};

    source.value.forEach((order) => {
      const date = order.checkedOutAt.substring(0, 10); // YYYY-MM-DD
      if (!byDate[date]) {
        byDate[date] = { date, revenueCents: 0, count: 0 };
      }
      byDate[date].revenueCents += toCents(order.total);
      byDate[date].count += 1;
    });

    return Object.values(byDate).sort((a, b) => a.date.localeCompare(b.date)).map(({ revenueCents, ...entry }) => ({ ...entry, revenue: fromCents(revenueCents) }));
  });

  // Weekly revenue data (last 12 weeks)
  const weeklyRevenue = computed(() => {
    const byWeek = {};

    source.value.forEach((order) => {
      const date = new Date(order.checkedOutAt);
      const weekStart = new Date(date);
      weekStart.setDate(date.getDate() - date.getDay()); // Start of week (Sunday)
      const weekKey = weekStart.toISOString().substring(0, 10);

      if (!byWeek[weekKey]) {
        byWeek[weekKey] = { weekStart: weekKey, revenueCents: 0, count: 0 };
      }
      byWeek[weekKey].revenueCents += toCents(order.total);
      byWeek[weekKey].count += 1;
    });

    return Object.values(byWeek).sort((a, b) => a.weekStart.localeCompare(b.weekStart)).slice(-12).map(({ revenueCents, ...entry }) => ({ ...entry, revenue: fromCents(revenueCents) }));
  });

  // Monthly revenue data (last 12 months)
  const monthlyRevenue = computed(() => {
    const byMonth = {};

    source.value.forEach((order) => {
      const month = order.checkedOutAt.substring(0, 7); // YYYY-MM
      if (!byMonth[month]) {
        byMonth[month] = { month, revenueCents: 0, count: 0 };
      }
      byMonth[month].revenueCents += toCents(order.total);
      byMonth[month].count += 1;
    });

    return Object.values(byMonth).sort((a, b) => a.month.localeCompare(b.month)).slice(-12).map(({ revenueCents, ...entry }) => ({ ...entry, revenue: fromCents(revenueCents) }));
  });

  // Top selling products
  const topSellingProducts = computed(() => {
    const productSales = {};

    source.value.forEach((order) => {
      order.items.forEach((item) => {
        if (!productSales[item.name]) {
          productSales[item.name] = {
            name: item.name,
            quantity: 0,
            revenueCents: 0,
          };
        }
        productSales[item.name].quantity += item.quantity;
        productSales[item.name].revenueCents += item.subtotal === undefined ? toCents(item.price) * item.quantity : toCents(item.subtotal);
      });
    });

    return Object.values(productSales)
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 10)
      .map(({ revenueCents, ...entry }) => ({ ...entry, revenue: fromCents(revenueCents) }));
  });

  // Peak hours analysis (by hour of day)
  const peakHours = computed(() => {
    const byHour = {};

    for (let i = 0; i < 24; i++) {
      byHour[i] = { hour: `${String(i).padStart(2, "0")}:00`, revenueCents: 0, count: 0 };
    }

    source.value.forEach((order) => {
      const hour = parseInt(order.checkedOutAt.substring(11, 13), 10);
      byHour[hour].revenueCents += toCents(order.total);
      byHour[hour].count += 1;
    });

    return Object.values(byHour).map(({ revenueCents, ...entry }) => ({ ...entry, revenue: fromCents(revenueCents) }));
  });

  // Summary statistics
  const analytics = computed(() => {
    const totalRevenueCents = source.value.reduce((sum, order) => sum + toCents(order.total), 0);
    const totalOrders = source.value.length;
    const averageOrderValueCents = totalOrders > 0 ? Math.round(totalRevenueCents / totalOrders) : 0;

    // Get today's date range
    const today = new Date();
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString().substring(0, 10);
    const todayRevenueCents = source.value
      .filter((order) => order.checkedOutAt.substring(0, 10) === todayStart)
      .reduce((sum, order) => sum + toCents(order.total), 0);

    // Get this week's date range
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - today.getDay());
    const weekStartKey = weekStart.toISOString().substring(0, 10);
    const thisWeekRevenueCents = source.value
      .filter((order) => order.checkedOutAt.substring(0, 10) >= weekStartKey)
      .reduce((sum, order) => sum + toCents(order.total), 0);

    // Get this month's date range
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().substring(0, 7);
    const thisMonthRevenueCents = source.value
      .filter((order) => order.checkedOutAt.substring(0, 7) === monthStart)
      .reduce((sum, order) => sum + toCents(order.total), 0);

    return {
      totalRevenue: fromCents(totalRevenueCents),
      totalOrders,
      averageOrderValue: fromCents(averageOrderValueCents),
      todayRevenue: fromCents(todayRevenueCents),
      thisWeekRevenue: fromCents(thisWeekRevenueCents),
      thisMonthRevenue: fromCents(thisMonthRevenueCents),
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

import { api } from "./api";
import { useProductsStore } from "../stores/products";
import { useOrdersStore } from "../stores/orders";
import { useCouponsStore } from "../stores/coupons";
import { useTaxStore } from "../stores/taxes";
import { usePosStore } from "../stores/pos";

export async function loadData() {
  const data = await api("/bootstrap");
  useProductsStore().products = data.products;
  useOrdersStore().orders = data.orders;
  useCouponsStore().coupons = data.coupons;
  useTaxStore().categoryTaxRates = data.taxRates;
  usePosStore().parkedOrders = data.parkedOrders;
}

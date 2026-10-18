export const PRODUCT_ICONS = Object.freeze([
  { value: "🍪", label: "Cookie" },
  { value: "🍫", label: "Chocolate" },
  { value: "🥤", label: "Drink" },
  { value: "🍿", label: "Popcorn" },
  { value: "🍞", label: "Bread" },
  { value: "🍬", label: "Candy" },
  { value: "☕", label: "Coffee" },
  { value: "🍜", label: "Noodles" },
  { value: "🥛", label: "Milk" },
  { value: "🧃", label: "Juice" },
  { value: "🍎", label: "Fruit" },
  { value: "🛒", label: "Groceries" },
  { value: "🎒", label: "Accessories" }
]);

export const PRODUCT_ICON_VALUES = new Set(PRODUCT_ICONS.map((icon) => icon.value));

import type { Restaurant, Food, Category } from "./types";
export const demoRestaurant: Restaurant = {
  id: "demo",
  owner_id: "",
  name: "The Green Table",
  slug: "demo",
  logo_url: null,
  theme_color: "#245b47",
  is_open: true,
  tax_percent: 5,
  discount_percent: 0,
  upi_id: null,
};
export const demoCategories: Category[] = [
  "Signature dishes",
  "Small plates",
  "From the tandoor",
  "Sweet endings",
  "Sips & coolers",
].map((name, i) => ({
  id: String(i),
  name,
  restaurant_id: "demo",
  sort_order: i,
}));
const photos = [
  "photo-1565557623262-b51c2513a641",
  "photo-1631452180519-c014fe946bc7",
  "photo-1546833999-b9f581a1996d",
  "photo-1601050690597-df0568f70950",
  "photo-1517244683847-7456b63c5969",
  "photo-1544787219-7f47ccb76574",
];
export const demoFoods: Food[] = [
  {
    name: "Hyderabadi dum biryani",
    name_te: "హైదరాబాదీ దమ్ బిర్యానీ",
    name_hi: "हैदराबादी दम बिरयानी",
    description:
      "Slow-cooked basmati, fragrant spices & a little Hyderabad soul.",
    price: 320,
    is_veg: false,
    category_id: "0",
  },
  {
    name: "Paneer butter masala",
    name_te: "పనీర్ బటర్ మసాలా",
    name_hi: "पनीर बटर मसाला",
    description: "Soft paneer in our silky tomato gravy. A table favourite.",
    price: 260,
    is_veg: true,
    category_id: "0",
  },
  {
    name: "Tandoori chicken",
    name_te: "తందూరీ చికెన్",
    name_hi: "तंदूरी चिकन",
    description:
      "Charred at the edges, tender at heart. Mint chutney on the side.",
    price: 340,
    is_veg: false,
    category_id: "2",
  },
  {
    name: "Crispy vegetable samosas",
    name_te: "వెజిటబుల్ సమోసాలు",
    name_hi: "वेज समोसे",
    description: "Golden pastry, spiced potatoes, tamarind & mint.",
    price: 120,
    is_veg: true,
    category_id: "1",
  },
  {
    name: "Gulab jamun",
    name_te: "గులాబ్ జామున్",
    name_hi: "गुलाब जामुन",
    description: "Warm, soft and soaked in rose-scented syrup.",
    price: 110,
    is_veg: true,
    category_id: "3",
  },
  {
    name: "Fresh lime cooler",
    name_te: "నిమ్మరసం",
    name_hi: "नींबू शरबत",
    description: "Freshly squeezed lime, mint and a sparkling finish.",
    price: 90,
    is_veg: true,
    category_id: "4",
  },
].map((f, i) => ({
  ...f,
  id: String(i),
  restaurant_id: "demo",
  available: true,
  photo_url:
    "https://images.unsplash.com/" +
    photos[i] +
    "?auto=format&fit=crop&w=700&q=80",
}));

export type Restaurant = {
  id: string;
  owner_id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  theme_color: string;
  is_open: boolean;
  tax_percent: number;
  discount_percent: number;
  upi_id: string | null;
};
export type Category = {
  id: string;
  restaurant_id: string;
  name: string;
  sort_order: number;
};
export type Food = {
  id: string;
  restaurant_id: string;
  category_id: string | null;
  name: string;
  name_te: string | null;
  name_hi: string | null;
  description: string;
  price: number;
  photo_url: string | null;
  is_veg: boolean;
  available: boolean;
};
export type Table = {
  id: string;
  restaurant_id: string;
  table_no: number;
  active: boolean;
};
export type Status =
  "placed" | "accepted" | "preparing" | "served" | "paid" | "cancelled";
export type Line = {
  id: string;
  name: string;
  quantity: number;
  unit_price: number;
};
export type Order = {
  id: string;
  restaurant_id: string;
  table_no: number;
  customer_id: string;
  status: Status;
  notes: string;
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  created_at: string;
  paid_at: string | null;
  order_items: Line[];
};
export type Request = {
  id: string;
  table_no: number;
  kind: "waiter" | "bill";
  resolved: boolean;
  created_at: string;
};
export const money = (n: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(
    Number(n),
  );

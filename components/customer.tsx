"use client";
import MenuAds from "./menu-ads";
import { useEffect, useRef, useState } from "react";
import {
  Leaf,
  Search,
  ShoppingBag,
  Plus,
  Minus,
  ArrowRight,
  Clock,
  Bell,
  Receipt,
  Check,
  X,
} from "lucide-react";
import { db, configured } from "@/lib/supabase/client";
import { demoRestaurant, demoCategories, demoFoods } from "@/lib/demo";
import {
  type Restaurant,
  type Category,
  type Food,
  type Order,
  money,
} from "@/lib/types";
import { useLanguage } from "./preferences";
import { Payment } from "./payment";
export default function Customer({
  slug,
  tableNo,
}: {
  slug: string;
  tableNo: number;
}) {
  const demo = slug === "demo",
    { lang, t } = useLanguage();
  const [r, setR] = useState<Restaurant | null>(demo ? demoRestaurant : null),
    [foods, setFoods] = useState<Food[]>(demo ? demoFoods : []),
    [categories, setCategories] = useState<Category[]>(
      demo ? demoCategories : [],
    );
  const [cart, setCart] = useState<Record<string, number>>({}),
    [orders, setOrders] = useState<Order[]>([]),
    [view, setView] = useState<"menu" | "orders">("menu"),
    [filter, setFilter] = useState("all"),
    [query, setQuery] = useState(""),
    [veg, setVeg] = useState(false),
    [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(!demo),
    [error, setError] = useState(""),
    [toast, setToast] = useState(""),
    [busy, setBusy] = useState(false),
    [guestUnavailable, setGuestUnavailable] = useState(false),
    [validTable, setValidTable] = useState(demo && tableNo > 0),
    [cartOpen, setCartOpen] = useState(false),
    [connected, setConnected] = useState(false);
  const key = useRef<string | null>(null),
    lock = useRef(false),
    uid = useRef("");
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 4500);
    return () => clearTimeout(timer);
  }, [toast]);
  useEffect(() => {
    if (demo) return;
    if (!configured) {
      setError(
        "This restaurant is not connected yet. Please ask a staff member.",
      );
      setLoading(false);
      return;
    }
    let active = true;
    const client = db();
    let channel: ReturnType<typeof client.channel> | undefined;
    let poll: ReturnType<typeof setInterval> | undefined;
    async function start() {
      try {
        const { data: restaurant, error: re } = await client
          .from("restaurants")
          .select("*")
          .eq("slug", slug)
          .single();
        if (re || !restaurant) throw Error("Restaurant not found");
        const rid = restaurant.id;
        const [f, c, tb] = await Promise.all([
          client
            .from("menu_items")
            .select("*")
            .eq("restaurant_id", rid)
            .order("name"),
          client
            .from("categories")
            .select("*")
            .eq("restaurant_id", rid)
            .order("sort_order"),
          client
            .from("tables")
            .select("*")
            .eq("restaurant_id", rid)
            .eq("table_no", tableNo)
            .eq("active", true)
            .maybeSingle(),
        ]);
        if (f.error || c.error || tb.error)
          throw Error("Could not load the menu. Please try again.");
        if (!active) return;
        setR(restaurant);
        setFoods(f.data || []);
        setCategories(c.data || []);
        setValidTable(!!tb.data);
        uid.current = "";
        const {
          data: { session },
        } = await client.auth.getSession();
        let user = session?.user;
        if (!user) {
          const { data } = await client.auth.signInAnonymously();
          user = data.user ?? undefined;
        }
        if (!active) return;
        uid.current = user?.id ?? "";
        setGuestUnavailable(!user);
        if (tb.data && user) {
          void client.rpc("record_menu_visit", { r: rid, t: tableNo }).then(({ error }) => {
            if (error) console.warn("Menu visit could not be recorded.");
          });
        }
        async function refresh() {
          const { o, fo, ro } = await (async () => {
            const [o, fo, ro] = await Promise.all([
              user ? client
                .from("orders")
                .select("*,order_items(*)")
                .eq("restaurant_id", rid)
                .eq("customer_id", uid.current)
                .eq("table_no", tableNo)
                .order("created_at", { ascending: false }) : { data: [], error: null },
              client
                .from("menu_items")
                .select("*")
                .eq("restaurant_id", rid)
                .order("name"),
              client.from("restaurants").select("*").eq("id", rid).single(),
            ]);
            return { o, fo, ro };
          })();
          if (active) {
            if (o.error) setError(o.error.message);
            else setOrders(o.data || []);
            if (fo.data) setFoods(fo.data);
            if (ro.data) setR(ro.data);
          }
        }
        await refresh();
        if (!active) return;
        poll = setInterval(refresh, 15000);
        if (!user) return;
        channel = client
          .channel("guest-" + rid + "-" + tableNo)
          .on(
            "postgres_changes",
            {
              event: "*",
              schema: "public",
              table: "orders",
              filter: "customer_id=eq." + uid.current,
            },
            refresh,
          )
          .on(
            "postgres_changes",
            {
              event: "*",
              schema: "public",
              table: "menu_items",
              filter: "restaurant_id=eq." + rid,
            },
            refresh,
          )
          .on(
            "postgres_changes",
            {
              event: "UPDATE",
              schema: "public",
              table: "restaurants",
              filter: "id=eq." + rid,
            },
            refresh,
          )
          .subscribe((status) => {
            if (active) setConnected(status === "SUBSCRIBED");
          });
      } catch (e) {
        if (active)
          setError(e instanceof Error ? e.message : "Unable to load menu");
      } finally {
        if (active) setLoading(false);
      }
    }
    start();
    return () => {
      active = false;
      if (channel) client.removeChannel(channel);
      if (poll) clearInterval(poll);
    };
  }, [slug, tableNo, demo]);
  function change(id: string, n: number) {
    key.current = null;
    setCart((c) => ({
      ...c,
      [id]: Math.min(50, Math.max(0, (c[id] || 0) + n)),
    }));
  }
  const lines = foods.filter((f) => cart[f.id] > 0),
    count = lines.reduce((s, f) => s + cart[f.id], 0),
    subtotal = lines.reduce((s, f) => s + Number(f.price) * cart[f.id], 0),
    discount = Math.round(subtotal * Number(r?.discount_percent || 0)) / 100,
    tax = Math.round((subtotal - discount) * Number(r?.tax_percent || 0)) / 100,
    total = subtotal - discount + tax;
  async function place() {
    if (lock.current || !r?.is_open || guestUnavailable) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      if (demo)
        throw Error(
          "This is a sample menu. Connect your Supabase project to place real orders.",
        );
      if (!validTable) throw Error("Please scan a valid table QR.");
      key.current ??= crypto.randomUUID();
      const { error } = await db().rpc("place_order", {
        restaurant_id: r!.id,
        table_no: tableNo,
        items: lines.map((f) => ({ id: f.id, quantity: cart[f.id] })),
        notes,
        request_id: key.current,
      });
      if (error) throw error;
      key.current = null;
      setCart({});
      setNotes("");
      setCartOpen(false);
      const { data, error: oe } = await db()
        .from("orders")
        .select("*,order_items(*)")
        .eq("restaurant_id", r!.id)
        .eq("customer_id", uid.current)
        .eq("table_no", tableNo)
        .order("created_at", { ascending: false });
      if (oe) throw oe;
      setOrders(data || []);
      setView("orders");
      setToast("Order placed — the kitchen has it!");
    } catch (e) {
      setError(
        e instanceof Error ? e.message : (e as { message: string }).message,
      );
    } finally {
      setBusy(false);
      lock.current = false;
    }
  }
  async function request(kind: "waiter" | "bill") {
    if (guestUnavailable) return;
    if (demo) {
      setToast("Sample menu — service requests are disabled.");
      return;
    }
    setBusy(true);
    const { error } = await db().rpc("request_service", {
      restaurant_id: r!.id,
      table_no: tableNo,
      kind,
    });
    setBusy(false);
    if (error) setError(error.message);
    else
      setToast(
        kind === "waiter"
          ? "A staff member will be with you shortly."
          : "Your bill has been requested.",
      );
  }
  if (loading)
    return (
      <main className="center">
        <Leaf className="spin" />
        <p>Setting your table…</p>
      </main>
    );
  if (!r)
    return (
      <main className="center">
        <h2>We couldn’t find your table.</h2>
        <p role="alert">{error}</p>
        <a href="/">Back home</a>
      </main>
    );
  const showOrdering = r.is_open && !guestUnavailable;
  return (
    <div
      className="customer"
      style={{ "--accent": r.theme_color } as React.CSSProperties}
    >
      <header className="menu-header">
        <a href="/" className="brand">
          {r.logo_url ? (
            <img className="logo" src={r.logo_url} alt="" />
          ) : (
            <Leaf />
          )}
          {r.name}
        </a>
        <div className="table-pill">
          <span className="dot" />
          {t.table} {tableNo || "—"}
        </div>
      </header>
      {demo && (
        <div className="demo-banner">
          SAMPLE MENU · Explore freely. Orders and service requests are
          disabled.
        </div>
      )}
      <div className={showOrdering ? "menu-body" : "menu-body browse-only"}>
        <div className="menu-main">
          {!demo && <MenuAds key={r.id} restaurant={r.id}/>}
          <section className="menu-hero">
            <div>
              <p className="eyebrow">FRESH FROM OUR KITCHEN</p>
              <h1>
                A good meal.
                <br />
                <em>A great moment.</em>
              </h1>
              <p>Settle in. Find a favourite. We’ll take care of the rest.</p>
              <span className="hero-label">
                <Clock size={14} /> Made to order · Served with care
              </span>
            </div>
            <div className="hero-dish">🍛</div>
          </section>
          {!r.is_open && <p className="menu-mode-note" role="status">{lang === "te" ? "మెనూ చూడండి. ఆర్డర్ కోసం సిబ్బందిని సంప్రదించండి." : lang === "hi" ? "मेन्यू देखें। ऑर्डर देने के लिए स्टाफ़ से बात करें।" : "Browse the menu. To order, please speak with our team."}</p>}
          {r.is_open && guestUnavailable && <p className="menu-mode-note" role="status">Online ordering is temporarily unavailable. You can browse the menu and order with our team.</p>}
          {showOrdering && <nav className="view-tabs">
            <button
              className={view === "menu" ? "active" : ""}
              onClick={() => setView("menu")}
            >
              {t.menu}
            </button>
            <button
              className={view === "orders" ? "active" : ""}
              onClick={() => setView("orders")}
            >
              {t.orders} <span>{orders.length}</span>
            </button>
            <span className="live">
              <span className="dot" />
              {demo
                ? "Preview"
                : connected
                  ? t.refresh
                  : "Reconnecting · 15s refresh"}
            </span>
          </nav>}
          {error && (
            <div role="alert" className="error">
              {error}
              <button aria-label="Dismiss error" onClick={() => setError("")}>
                <X size={16} />
              </button>
            </div>
          )}
          {showOrdering && !validTable && (
            <p className="error">Scan a valid table QR to order.</p>
          )}
          {!showOrdering || view === "menu" ? (
            <>
              <div className="search-row">
                <div className="search">
                  <Search size={18} />
                  <input
                    aria-label={t.search}
                    placeholder={t.search}
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                </div>
                <label className="veg-filter">
                  <input
                    type="checkbox"
                    checked={veg}
                    onChange={(e) => setVeg(e.target.checked)}
                  />
                  <span className="veg-dot" /> {t.veg}
                </label>
              </div>
              <div className="category-tabs">
                <button
                  className={filter === "all" ? "selected" : ""}
                  onClick={() => setFilter("all")}
                >
                  {t.all}
                </button>
                {categories.map((c) => (
                  <button
                    key={c.id}
                    className={filter === c.id ? "selected" : ""}
                    onClick={() => setFilter(c.id)}
                  >
                    {c.name}
                  </button>
                ))}
              </div>
              <div className="section-heading">
                <h2>
                  {filter === "all"
                    ? "Something for every craving"
                    : categories.find((c) => c.id === filter)?.name}
                </h2>
                <span className="muted small">FRESHLY PREPARED, ALWAYS.</span>
              </div>
              <div className="food-grid">
                {foods
                  .filter(
                    (f) =>
                      (filter === "all" || f.category_id === filter) &&
                      (!veg || f.is_veg) &&
                      (f.name + " " + f.name_te + " " + f.name_hi)
                        .toLowerCase()
                        .includes(query.toLowerCase()),
                  )
                  .map((f) => (
                    <article
                      className={
                        "food-card " + (!f.available ? "unavailable" : "")
                      }
                      key={f.id}
                    >
                      <div className="food-photo">
                        {f.photo_url ? (
                          <img loading="lazy" src={f.photo_url} alt={f.name} />
                        ) : (
                          <span>🍽️</span>
                        )}
                        <span
                          className={"food-tag " + (!f.is_veg ? "nonveg" : "")}
                        >
                          <span className="veg-dot" />
                          {f.is_veg ? t.veg : t.nonveg}
                        </span>
                      </div>
                      <div className="food-content">
                        <h3>
                          {lang === "te"
                            ? f.name_te || f.name
                            : lang === "hi"
                              ? f.name_hi || f.name
                              : f.name}
                        </h3>
                        <p>{f.description}</p>
                        <div className="food-bottom">
                          <strong>{money(f.price)}</strong>
                          {!f.available ? (
                            <span>{t.out}</span>
                          ) : !showOrdering ? null : cart[f.id] ? (
                            <div className="quantity">
                              <button
                                aria-label={"Remove " + f.name}
                                disabled={busy}
                                onClick={() => change(f.id, -1)}
                              >
                                <Minus size={14} />
                              </button>
                              <span>{cart[f.id]}</span>
                              <button
                                aria-label={"Add " + f.name}
                                disabled={busy}
                                onClick={() => change(f.id, 1)}
                              >
                                <Plus size={14} />
                              </button>
                            </div>
                          ) : (
                            <button
                              className="add-button"
                              disabled={!r.is_open || busy}
                              onClick={() => change(f.id, 1)}
                            >
                              {t.add}
                              <Plus size={15} />
                            </button>
                          )}
                        </div>
                      </div>
                    </article>
                  ))}
              </div>
            </>
          ) : (
            <section className="order-list">
              {!orders.length ? (
                <div className="empty">
                  <Receipt size={40} />
                  <h2>No orders just yet.</h2>
                  <button className="secondary" onClick={() => setView("menu")}>
                    {t.browse}
                  </button>
                </div>
              ) : (
                orders.map((o) => (
                  <article className="order-card" key={o.id}>
                    <div className="row">
                      <h3>#{o.id.slice(0, 8)}</h3>
                      <span className={"status " + o.status}>
                        {t[o.status]}
                      </span>
                    </div>
                    <p className="muted small">
                      {new Date(o.created_at).toLocaleString()} · {t.table}{" "}
                      {o.table_no}
                    </p>
                    <div className="status-track">
                      {(
                        ["placed", "accepted", "preparing", "served"] as const
                      ).map((s, i) => (
                        <span
                          key={s}
                          className={
                            [
                              "placed",
                              "accepted",
                              "preparing",
                              "served",
                              "paid",
                            ].indexOf(o.status) >= i
                              ? "done"
                              : ""
                          }
                        >
                          <Check size={13} />
                          {t[s]}
                        </span>
                      ))}
                    </div>
                    {o.order_items.map((l) => (
                      <div className="row" key={l.id}>
                        <span>
                          {l.quantity} × {l.name}
                        </span>
                        <span>{money(l.quantity * l.unit_price)}</span>
                      </div>
                    ))}
                    {o.notes && <p className="note">{o.notes}</p>}
                    <div className="bill-totals">
                      <div className="row">
                        <span>{t.subtotal}</span>
                        {money(o.subtotal)}
                      </div>
                      <div className="row">
                        <span>{t.discount}</span>−{money(o.discount)}
                      </div>
                      <div className="row">
                        <span>{t.tax}</span>
                        {money(o.tax)}
                      </div>
                      <div className="row">
                        <strong>{t.total}</strong>
                        <strong>{money(o.total)}</strong>
                      </div>
                    </div>
                    {r.upi_id && o.status === "served" && (
                      <Payment
                        upi={r.upi_id}
                        name={r.name}
                        amount={o.total}
                        reference={o.id}
                      />
                    )}
                  </article>
                ))
              )}
            </section>
          )}
        </div>
        {showOrdering && <aside className={"cart-panel " + (cartOpen ? "mobile-open" : "")}>
          <button
            className="mobile-close"
            aria-label="Close cart"
            onClick={() => setCartOpen(false)}
          >
            <X />
          </button>
          <div className="row">
            <ShoppingBag size={23} />
            <span className="eyebrow">
              {t.table} {tableNo || "—"}
            </span>
          </div>
          <h2>{t.cart}</h2>
          <p className="muted small">Good choices. Great company.</p>
          {!lines.length ? (
            <div className="empty">
              <ShoppingBag size={38} />
              <p>{t.empty}</p>
            </div>
          ) : (
            <>
              {lines.map((f) => (
                <div className="cart-line" key={f.id}>
                  <div>
                    <strong>{f.name}</strong>
                    <p>{money(f.price)}</p>
                  </div>
                  <div className="quantity">
                    <button
                      aria-label={"Remove " + f.name}
                      disabled={busy}
                      onClick={() => change(f.id, -1)}
                    >
                      <Minus size={12} />
                    </button>
                    {cart[f.id]}
                    <button
                      aria-label={"Add " + f.name}
                      disabled={busy}
                      onClick={() => change(f.id, 1)}
                    >
                      <Plus size={12} />
                    </button>
                  </div>
                </div>
              ))}
              <label>
                {t.notes}
                <textarea
                  maxLength={500}
                  disabled={busy}
                  value={notes}
                  onChange={(e) => {
                    setNotes(e.target.value);
                    key.current = null;
                  }}
                  placeholder="Less spicy, allergies, special requests…"
                />
              </label>
              <div className="bill-totals">
                <div className="row">
                  <span>{t.subtotal}</span>
                  {money(subtotal)}
                </div>
                <div className="row">
                  <span>{t.discount}</span>−{money(discount)}
                </div>
                <div className="row">
                  <span>
                    {t.tax} ({r.tax_percent}%)
                  </span>
                  {money(tax)}
                </div>
                <div className="row total">
                  <strong>{t.total}</strong>
                  <strong>{money(total)}</strong>
                </div>
              </div>
              <button
                className="primary full"
                disabled={busy || !r.is_open || !validTable}
                onClick={place}
              >
                {busy ? "…" : t.place}
                <ArrowRight size={17} />
              </button>
            </>
          )}
          <div className="service-buttons">
            <button
              disabled={busy || !validTable}
              onClick={() => request("waiter")}
            >
              <Bell size={17} />
              {t.waiter}
            </button>
            <button
              disabled={busy || !validTable}
              onClick={() => request("bill")}
            >
              <Receipt size={17} />
              {t.bill}
            </button>
          </div>
          <p className="muted small">
            Allergies? Please speak to our team before ordering.
          </p>
        </aside>}
      </div>
      {showOrdering && <button className="mobile-cart primary" onClick={() => setCartOpen(true)}>
        <ShoppingBag size={18} />
        {count} items · {money(total)}
        <ArrowRight size={18} />
      </button>}
      {toast && (
        <div role="status" className="toast">
          <Check size={18} />
          {toast}
        </div>
      )}
      <footer>
        POWERED BY VASHIBITE <span>Good food. Less waiting.</span>
      </footer>
    </div>
  );
}

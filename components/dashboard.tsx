"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Leaf,
  LayoutDashboard,
  UtensilsCrossed,
  QrCode,
  BarChart3,
  History,
  Settings,
  Users,
  LogOut,
  Bell,
  Volume2,
  Check,
  Printer,
  RefreshCw,
} from "lucide-react";
import { db } from "@/lib/supabase/client";
import {
  type Restaurant,
  type Order,
  type Request,
  type Status,
  money,
} from "@/lib/types";
import {
  MenuManager,
  TablesManager,
  SettingsManager,
  StaffManager,
  Reports,
} from "./management";
type Tab =
  | "Live orders"
  | "Menu manager"
  | "Tables & QR"
  | "Reports"
  | "Order history"
  | "Settings"
  | "Staff";
const tabs: { name: Tab; icon: typeof Leaf }[] = [
  { name: "Live orders", icon: LayoutDashboard },
  { name: "Menu manager", icon: UtensilsCrossed },
  { name: "Tables & QR", icon: QrCode },
  { name: "Reports", icon: BarChart3 },
  { name: "Order history", icon: History },
  { name: "Staff", icon: Users },
  { name: "Settings", icon: Settings },
];
export default function Dashboard() {
  const [savingMode, setSavingMode] = useState(false);
  const [r, setR] = useState<Restaurant | null>(null),
    [restaurants, setRestaurants] = useState<Restaurant[]>([]),
    [owner, setOwner] = useState(false),
    [tab, setTab] = useState<Tab>("Live orders"),
    [orders, setOrders] = useState<Order[]>([]),
    [requests, setRequests] = useState<Request[]>([]),
    [error, setError] = useState(""),
    [toast, setToast] = useState(""),
    [loading, setLoading] = useState(true),
    [connected, setConnected] = useState(false),
    [sound, setSound] = useState(false),
    [status, setStatus] = useState("all"),
    [day, setDay] = useState(""),
    [table, setTable] = useState(""),
    [page, setPage] = useState(0),
    [hasMore, setHasMore] = useState(false),
    [pending, setPending] = useState(""),
    [receipt, setReceipt] = useState<Order | null>(null);
  const audio = useRef<AudioContext | null>(null),
    seen = useRef(new Set<string>()),
    primed = useRef(false);
  const notify = useCallback((message: string) => {
    setToast(message);
    if (audio.current?.state === "running") {
      const oscillator = audio.current.createOscillator(),
        gain = audio.current.createGain();
      oscillator.connect(gain);
      gain.connect(audio.current.destination);
      oscillator.frequency.value = 880;
      gain.gain.setValueAtTime(0.16, audio.current.currentTime);
      gain.gain.exponentialRampToValueAtTime(
        0.001,
        audio.current.currentTime + 0.5,
      );
      oscillator.start();
      oscillator.stop(audio.current.currentTime + 0.5);
    }
  }, []);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 7000);
    return () => clearTimeout(t);
  }, [toast]);
  const load = useCallback(async () => {
    if (!r) return;
    let q = db()
      .from("orders")
      .select("*,order_items(*)")
      .eq("restaurant_id", r.id)
      .order("created_at", { ascending: false });
    if (tab === "Order history") {
      if (status !== "all") q = q.eq("status", status);
      if (day) {
        q = q
          .gte("created_at", day + "T00:00:00+05:30")
          .lt(
            "created_at",
            new Date(
              new Date(day + "T00:00:00+05:30").getTime() + 86400000,
            ).toISOString(),
          );
      }
      if (table) q = q.eq("table_no", Number(table));
      q = q.range(page * 30, page * 30 + 30);
    } else
      q = q
        .in("status", ["placed", "accepted", "preparing", "served"])
        .limit(500);
    const [{ data, error }, rq] = await Promise.all([
      q,
      db()
        .from("service_requests")
        .select("*")
        .eq("restaurant_id", r.id)
        .eq("resolved", false)
        .order("created_at"),
    ]);
    if (error) {
      setError(error.message);
      return;
    }
    if (rq.error) setError(rq.error.message);
    setHasMore((data?.length || 0) > 30);
    setOrders(tab === "Order history" ? (data || []).slice(0, 30) : data || []);
    setRequests(rq.data || []);
    if (tab !== "Order history") {
      const newOrders = (data || []).filter(
        (o) => o.status === "placed" && !seen.current.has(o.id),
      );
      if (primed.current && newOrders.length)
        notify(
          newOrders.length +
            " new order(s) — table " +
            newOrders.map((o) => o.table_no).join(", "),
        );
      (data || []).forEach((o) => seen.current.add(o.id));
      primed.current = true;
    }
  }, [r, tab, status, day, table, page, notify]);
  useEffect(() => {
    async function start() {
      try {
        const client = db();
        const {
          data: { user },
        } = await client.auth.getUser();
        if (!user) {
          location.href = "/restaurant/login";
          return;
        }
        const [own, members] = await Promise.all([
          client.from("restaurants").select("*").eq("owner_id", user.id),
          client
            .from("staff")
            .select("restaurant_id,role")
            .eq("user_id", user.id),
        ]);
        if (own.error || members.error) throw own.error || members.error;
        const ids = (members.data || []).map((m) => m.restaurant_id);
        let list = own.data || [];
        if (ids.length) {
          const { data, error } = await client
            .from("restaurants")
            .select("*")
            .in("id", ids);
          if (error) throw error;
          list = [
            ...list,
            ...(data || []).filter((x) => !list.some((o) => o.id === x.id)),
          ];
        }
        setRestaurants(list);
        setR(list[0] || null);
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setLoading(false);
      }
    }
    start();
  }, []);
  useEffect(() => {
    if (!r) return;
    let alive = true;
    db()
      .auth.getUser()
      .then(async ({ data: { user } }) => {
        const { data } = await db()
          .from("staff")
          .select("role")
          .eq("restaurant_id", r.id)
          .eq("user_id", user!.id)
          .maybeSingle();
        if (alive) setOwner(r.owner_id === user?.id || data?.role === "owner");
      });
    return () => {
      alive = false;
    };
  }, [r]);
  useEffect(() => {
    load();
    if (!r) return;
    const client = db();
    const ch = client
      .channel("desk-" + r.id)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "orders",
          filter: "restaurant_id=eq." + r.id,
        },
        load,
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "service_requests",
          filter: "restaurant_id=eq." + r.id,
        },
        (payload) => {
          load();
          if (payload.eventType === "INSERT")
            notify("Service request — table " + payload.new.table_no);
        },
      )
      .subscribe((s) => setConnected(s === "SUBSCRIBED"));
    const timer = setInterval(load, 15000);
    return () => {
      client.removeChannel(ch);
      clearInterval(timer);
    };
  }, [r, load, notify]);
  async function update(o: Order, next: Status) {
    setPending(o.id);
    const { error } = await db().rpc("change_order_status", {
      order_id: o.id,
      next_status: next,
    });
    if (error) setError(error.message);
    await load();
    setPending("");
  }
  function print(o: Order) {
    setReceipt(o);
    setTimeout(() => window.print(), 100);
  }
  if (loading) return <main className="center">Opening your restaurant…</main>;
  if (!r)
    return (
      <main className="center">
        <h2>One more step.</h2>
        <p>
          No restaurant is assigned to this account. Run the owner bootstrap SQL
          in the setup guide or ask your owner to add you.
        </p>
        {error && <p className="error">{error}</p>}
        <button
          className="secondary"
          onClick={async () => {
            await db().auth.signOut();
            location.href = "/restaurant/login";
          }}
        >
          Sign out
        </button>
      </main>
    );
  const placed = orders.filter((o) => o.status === "placed").length;
  return (
    <div className="dashboard">
      <aside className="sidebar no-print">
        <a className="brand" href="/">
          <Leaf />
          tableleaf
        </a>
        <div className="restaurant-switch">
          <span className="eyebrow">YOUR RESTAURANT</span>
          <select
            aria-label="Restaurant"
            value={r.id}
            onChange={(e) => {
              setR(restaurants.find((x) => x.id === e.target.value)!);
              seen.current.clear();
              primed.current = false;
              setTab("Live orders");
              setPage(0);
            }}
          >
            {restaurants.map((x) => (
              <option key={x.id} value={x.id}>
                {x.name}
              </option>
            ))}
          </select>
          <span className="small muted">
            {owner ? "Owner workspace" : "Kitchen workspace"}
          </span>
        </div>
        <nav>
          {tabs
            .filter(
              (t) =>
                owner || t.name === "Live orders" || t.name === "Order history",
            )
            .map((t) => (
              <button
                key={t.name}
                onClick={() => {
                  setTab(t.name);
                  setPage(0);
                }}
                className={tab === t.name ? "active" : ""}
              >
                <t.icon size={18} />
                {t.name}
                {t.name === "Live orders" && placed > 0 && (
                  <span className="badge">{placed}</span>
                )}
              </button>
            ))}
        </nav>
        <div className="sidebar-bottom">
          <a
            href={"/r/" + r.slug + "?table=1"}
            target="_blank"
            rel="noreferrer"
          >
            Open customer menu ↗
          </a>
          <button
            onClick={async () => {
              await db().auth.signOut();
              location.href = "/restaurant/login";
            }}
          >
            <LogOut size={17} /> Sign out
          </button>
          <p className="small muted">A calmer service starts here.</p>
        </div>
      </aside>
      <main className="desk no-print">
        <header className="desk-header">
          <div>
            <p className="eyebrow">YOUR DAILY SERVICE, SIMPLIFIED</p>
            <h1>{tab}</h1>
            <p className="muted">
              {tab === "Live orders"
                ? "A little organisation. A lot of happy tables."
                : "Make it yours. Keep it effortless."}
            </p>
          </div>
          <div className="actions">
            <span className="live">
              <span className="dot" />
              {connected ? "Live" : "15s refresh"}
            </span>
            <button
              className="secondary"
              onClick={async () => {
                audio.current ??= new AudioContext();
                await audio.current.resume();
                setSound(true);
              }}
            >
              <Volume2 size={16} />
              {sound ? "Sound on" : "Enable sound"}
            </button>
          </div>
        </header>
        {error && (
          <div role="alert" className="error">
            {error}
            <button onClick={() => setError("")}>Dismiss</button>
          </div>
        )}
        {(tab === "Live orders" || tab === "Order history") && (
          <>
            {tab === "Live orders" && (
              <>
                <div className="stats-grid">
                  <div>
                    <span className="muted">Waiting for you</span>
                    <strong>{placed.toString().padStart(2, "0")}</strong>
                    <span>New orders</span>
                  </div>
                  <div>
                    <span className="muted">In the kitchen</span>
                    <strong>
                      {orders
                        .filter((o) =>
                          ["accepted", "preparing"].includes(o.status),
                        )
                        .length.toString()
                        .padStart(2, "0")}
                    </strong>
                    <span>Cooking up something good</span>
                  </div>
                  <div>
                    <span className="muted">At the table</span>
                    <strong>
                      {orders
                        .filter((o) => o.status === "served")
                        .length.toString()
                        .padStart(2, "0")}
                    </strong>
                    <span>Awaiting payment</span>
                  </div>
                  <div>
                    <span className="muted">Customer ordering</span>
                    <div className="order-mode-control">
                      {owner && <button type="button" role="switch"
                        aria-label="Accept customer orders" aria-checked={r.is_open}
                        className="order-mode-switch" disabled={savingMode}
                        onClick={async () => {
                          setSavingMode(true);
                          try {
                            const { data, error } = await db().from("restaurants")
                              .update({ is_open: !r.is_open }).eq("id", r.id).select("is_open").single();
                            if (error) throw error;
                            const update = (item: Restaurant) => item.id === r.id ? { ...item, is_open: data.is_open } : item;
                            setR(current => current && update(current));
                            setRestaurants(list => list.map(update));
                          } catch (cause) {
                            setError((cause as Error).message || "Could not update customer ordering.");
                          } finally { setSavingMode(false); }
                        }}><i /></button>}
                      <b aria-live="polite">{savingMode ? "Saving…" : r.is_open ? "On" : "Menu only"}</b>
                    </div>
                    <span>{r.is_open ? "Guests can place orders" : "Guests can browse dishes"}</span>
                  </div>
                </div>
                {requests.length > 0 && (
                  <section className="requests">
                    <h3>
                      <Bell size={18} /> A table needs you
                    </h3>
                    {requests.map((q) => (
                      <div className="row" key={q.id}>
                        <span>
                          Table {q.table_no} ·{" "}
                          {q.kind === "bill" ? "Bill requested" : "Call waiter"}{" "}
                          · {new Date(q.created_at).toLocaleTimeString()}
                        </span>
                        <button
                          className="secondary"
                          disabled={pending === q.id}
                          onClick={async () => {
                            setPending(q.id);
                            const { error } = await db().rpc(
                              "resolve_request",
                              { request_id: q.id },
                            );
                            if (error) setError(error.message);
                            await load();
                            setPending("");
                          }}
                        >
                          <Check size={14} />
                          Done
                        </button>
                      </div>
                    ))}
                  </section>
                )}
              </>
            )}
            {tab === "Order history" && (
              <div className="filters">
                <label>
                  Status
                  <select
                    value={status}
                    onChange={(e) => {
                      setStatus(e.target.value);
                      setPage(0);
                    }}
                  >
                    {[
                      "all",
                      "placed",
                      "accepted",
                      "preparing",
                      "served",
                      "paid",
                      "cancelled",
                    ].map((x) => (
                      <option key={x}>{x}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Date (India)
                  <input
                    type="date"
                    value={day}
                    onChange={(e) => {
                      setDay(e.target.value);
                      setPage(0);
                    }}
                  />
                </label>
                <label>
                  Table
                  <input
                    type="number"
                    min="1"
                    value={table}
                    onChange={(e) => {
                      setTable(e.target.value);
                      setPage(0);
                    }}
                    placeholder="All"
                  />
                </label>
                <button className="secondary" onClick={() => load()}>
                  <RefreshCw size={15} />
                  Refresh
                </button>
              </div>
            )}
            <div className="section-heading">
              <h2>
                {tab === "Live orders" ? "On the board" : "Past & present"}
              </h2>
              <span className="muted small">{orders.length} ORDERS SHOWN</span>
            </div>
            <div className="orders-grid">
              {orders.map((o) => (
                <article className="order-card" key={o.id}>
                  <div className="row">
                    <h3>Table {o.table_no}</h3>
                    <span className={"status " + o.status}>{o.status}</span>
                  </div>
                  <p className="small muted">
                    #{o.id.slice(0, 8)} ·{" "}
                    {new Date(o.created_at).toLocaleString()}
                  </p>
                  <div className="order-lines">
                    {o.order_items.map((l) => (
                      <div className="row" key={l.id}>
                        <span>
                          <b>{l.quantity}×</b> {l.name}
                        </span>
                        <span>{money(l.quantity * l.unit_price)}</span>
                      </div>
                    ))}
                  </div>
                  {o.notes && <p className="note">“{o.notes}”</p>}
                  <div className="row total">
                    <span>Total incl. tax</span>
                    <strong>{money(o.total)}</strong>
                  </div>
                  <div className="actions">
                    {o.status === "placed" && (
                      <button
                        className="primary"
                        disabled={pending === o.id}
                        onClick={() => update(o, "accepted")}
                      >
                        Take order
                      </button>
                    )}
                    {o.status === "accepted" && (
                      <button
                        className="primary"
                        disabled={pending === o.id}
                        onClick={() => update(o, "preparing")}
                      >
                        Start preparing
                      </button>
                    )}
                    {o.status === "preparing" && (
                      <button
                        className="primary"
                        disabled={pending === o.id}
                        onClick={() => update(o, "served")}
                      >
                        Mark served
                      </button>
                    )}
                    {o.status === "served" && owner && (
                      <button
                        className="primary"
                        disabled={pending === o.id}
                        onClick={() => {
                          if (
                            confirm(
                              "Confirm you have received " +
                                money(o.total) +
                                " for this order?",
                            )
                          )
                            update(o, "paid");
                        }}
                      >
                        Mark paid
                      </button>
                    )}
                    <button
                      className="icon-button"
                      aria-label="Print kitchen receipt"
                      onClick={() => print(o)}
                    >
                      <Printer size={18} />
                    </button>
                    {!["paid", "cancelled"].includes(o.status) && (
                      <button
                        className="text-button danger"
                        disabled={pending === o.id}
                        onClick={() => {
                          if (confirm("Cancel this order?"))
                            update(o, "cancelled");
                        }}
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                </article>
              ))}
            </div>
            {orders.length === 0 && (
              <div className="empty">
                <UtensilsCrossed size={40} />
                <h2>A quiet moment.</h2>
                <p>Orders will appear here as they come in.</p>
              </div>
            )}
            {tab === "Order history" && (
              <div className="actions">
                <button
                  className="secondary"
                  disabled={page === 0}
                  onClick={() => setPage((p) => p - 1)}
                >
                  Previous
                </button>
                <span>Page {page + 1}</span>
                <button
                  className="secondary"
                  disabled={!hasMore}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}
        {owner && tab === "Menu manager" && (
          <MenuManager restaurant={r} onError={setError} />
        )}
        {owner && tab === "Tables & QR" && (
          <TablesManager restaurant={r} onError={setError} />
        )}
        {owner && tab === "Settings" && (
          <SettingsManager
            restaurant={r}
            onError={setError}
            onSave={(x) => {
              setR(x);
              setRestaurants((rs) => rs.map((v) => (v.id === x.id ? x : v)));
              setToast("Settings saved");
            }}
          />
        )}
        {owner && tab === "Staff" && (
          <StaffManager restaurant={r} onError={setError} />
        )}
        {owner && tab === "Reports" && (
          <Reports restaurant={r} onError={setError} />
        )}
      </main>
      {toast && (
        <div role="status" className="toast no-print">
          <Bell size={18} />
          {toast}
          <button onClick={() => setToast("")}>×</button>
        </div>
      )}
      {receipt && (
        <div className="print-receipt">
          <h2>{r.name}</h2>
          <h3>KITCHEN TICKET · TABLE {receipt.table_no}</h3>
          <p>
            #{receipt.id.slice(0, 8)} ·{" "}
            {new Date(receipt.created_at).toLocaleString()}
          </p>
          <hr />
          {receipt.order_items.map((l) => (
            <p key={l.id}>
              <strong>
                {l.quantity} × {l.name}
              </strong>
            </p>
          ))}
          {receipt.notes && <p>NOTES: {receipt.notes}</p>}
          <hr />
          <p>Subtotal: {money(receipt.subtotal)}</p>
          <p>Discount: −{money(receipt.discount)}</p>
          <p>Tax: {money(receipt.tax)}</p>
          <strong>Total: {money(receipt.total)}</strong>
          <p>Status: {receipt.status}</p>
        </div>
      )}
    </div>
  );
}

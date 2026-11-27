"use client";
import { useState } from "react";
import Ads from "./ads";
import Link from "next/link";
import {
  Leaf,
  Store,
  IndianRupee,
  ScanLine,
  Receipt,
  ChevronDown,
  Download,
  LogOut,
} from "lucide-react";
import { money, type Restaurant } from "@/lib/types";
import { db } from "@/lib/supabase/client";

type Row = Restaurant & {
  location_name: string | null;
  email: string;
  phone_number: string | null;
  created_at: string;
  tables: number[];
  staff: number;
  revenue: number;
  paid: number;
  visits: number;
  dishes: {
    name: string;
    price: number;
    available: boolean;
    category: string | null;
    veg: boolean;
  }[];
};

const metrics = {
  revenue: "Paid revenue",
  paid: "Paid orders",
  visits: "Menu visits",
} as const;
type Metric = keyof typeof metrics;
const count = new Intl.NumberFormat("en-IN");

function exportDirectory(rows: Row[], days: number) {
  const escape = (value: string | number) => {
    const text = String(value);
    const safe =
      typeof value === "string" && /^[\s\uFEFF]*[=+@-]|^[\t\r\n]/.test(text)
        ? "'" + text
        : text;
    return '"' + safe.replaceAll('"', '""') + '"';
  };
  const cells = [
    [
      "Restaurant",
      "Slug",
      "Status",
      "Dishes",
      "Active tables",
      "Paid revenue (INR)",
      "Paid orders",
      "Menu visits",
    ],
    ...rows.map((r) => [
      r.name,
      r.slug,
      r.is_open ? "Open" : "Closed",
      r.dishes.length,
      r.tables.length,
      r.revenue,
      r.paid,
      r.visits,
    ]),
  ];
  const csv = cells.map((row) => row.map(escape).join(",")).join("\r\n");
  const url = URL.createObjectURL(
    new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = `tableleaf-restaurants-${days}d.csv`;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function Report({ rows, days }: { rows: Row[]; days: number }) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [sort, setSort] = useState<Metric | "name">("revenue");
  const [metric, setMetric] = useState<Metric>("revenue");
  const [signingOut, setSigningOut] = useState(false);
  const [error, setError] = useState("");
  const filtered = rows
    .filter((r) => {
      const matchesStatus =
        status === "all" ||
        (status === "setup"
          ? !r.tables.length || !r.dishes.some((d) => d.available)
          : r.is_open === (status === "open"));
      return (
        matchesStatus &&
        [r.name, r.slug, r.email, r.phone_number]
          .join(" ")
          .toLowerCase()
          .includes(query.trim().toLowerCase())
      );
    })
    .sort(
      (a, b) =>
        (sort === "name" ? 0 : b[sort] - a[sort]) ||
        a.name.localeCompare(b.name),
    );
  const sum = (key: Metric) => rows.reduce((v, r) => v + Number(r[key]), 0);
  const leaders = rows
    .filter((r) => r[metric] > 0)
    .sort((a, b) => b[metric] - a[metric])
    .slice(0, 5);

  async function signOut() {
    setSigningOut(true);
    setError("");
    try {
      const { error } = await db().auth.signOut();
      if (error) throw error;
      location.replace("/admin");
    } catch {
      setError("Could not sign out. Please try again.");
      setSigningOut(false);
    }
  }
  return (
    <main className="platform">
      <header>
        <a href="/" className="brand">
          <Leaf /> tableleaf
        </a>
        <button
          className="admin-action"
          onClick={signOut}
          disabled={signingOut}
        >
          <LogOut size={16} /> {signingOut ? "Signing out…" : "Sign out"}
        </button>
      </header>
      {error && <p role="alert">{error}</p>}
      <section className="platform-title">
        <div>
          <h1>Restaurant overview</h1>
          <p>Sales, menu activity and table traffic across your restaurants.</p>
        </div>
        <nav aria-label="Reporting period">
          {[1, 7, 30, 90].map((n) => (
            <Link
              key={n}
              aria-current={days === n ? "page" : undefined}
              href={`/admin?days=${n}`}
            >
              {n === 1 ? "24 hours" : n + " days"}
            </Link>
          ))}
        </nav>
      </section>
      <section className="platform-metrics">
        {[
          {
            label: "Restaurants",
            value: count.format(rows.length),
            icon: Store,
          },
          {
            label: "Paid revenue",
            value: money(sum("revenue")),
            icon: IndianRupee,
          },
          { label: "Paid orders", value: sum("paid"), icon: Receipt },
          { label: "Table menu visits", value: sum("visits"), icon: ScanLine },
        ].map(({ label, value, icon: Icon }) => (
          <article key={label}>
            <Icon size={20} />
            <p>{label}</p>
            <strong>{value}</strong>
          </article>
        ))}
      </section>
      <section className="directory" aria-labelledby="performance">
        <div className="admin-section-head">
          <h2 id="performance">Top restaurants</h2>
          <select
            aria-label="Performance metric"
            value={metric}
            onChange={(e) => setMetric(e.target.value as Metric)}
          >
            {Object.entries(metrics).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </div>
        {leaders.length ? (
          <ol className="admin-ranking">
            {leaders.map((r) => (
              <li key={r.id}>
                <strong>{r.name}</strong>
                <span>
                  {metric === "revenue"
                    ? money(r[metric])
                    : count.format(r[metric])}
                </span>
                <div className="admin-bar" aria-hidden="true">
                  <div
                    style={{
                      width: `${(100 * r[metric]) / leaders[0][metric]}%`,
                    }}
                  />
                </div>
              </li>
            ))}
          </ol>
        ) : (
          <p>No {metrics[metric].toLowerCase()} in the selected period.</p>
        )}
      </section>
      <section className="directory">
        <div className="admin-section-head">
          <div>
            <h2>Restaurant directory</h2>
            <p aria-live="polite">
              {filtered.length} of {rows.length} restaurants
            </p>
          </div>
          <button
            className="admin-action"
            onClick={() => exportDirectory(filtered, days)}
            disabled={!filtered.length}
          >
            <Download size={16} /> Export CSV
          </button>
        </div>
        <div className="filters">
          <input
            type="search"
            aria-label="Search restaurants"
            placeholder="Search name, email or phone"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <select
            aria-label="Restaurant filter"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="all">All restaurants</option>
            <option value="open">Open</option>
            <option value="closed">Closed</option>
            <option value="setup">Needs setup</option>
          </select>
          <select
            aria-label="Sort restaurants"
            value={sort}
            onChange={(e) => setSort(e.target.value as Metric | "name")}
          >
            {Object.entries(metrics).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
            <option value="name">Name A–Z</option>
          </select>
        </div>
        {status === "setup" && <p>No active tables or no available dishes.</p>}
        {filtered.map((r) => (
          <details key={r.id}>
            <summary>
              <div>
                <b>{r.name}</b>
                <small>
                  {r.is_open ? "Open" : "Closed"} · {r.dishes.length} dishes ·{" "}
                  {r.tables.length} active tables
                </small>
              </div>
              <div>
                <b>{money(r.revenue)}</b>
                <small>
                  {r.paid} paid orders · {r.visits} visits
                </small>
              </div>
              <ChevronDown size={18} />
            </summary>
            <div className="restaurant-info">
              <dl>
                {Object.entries({
                  Location: r.location_name,
                  "Owner email": r.email,
                  "Restaurant phone": r.phone_number,
                  "Menu path": "/r/" + r.slug,
                  Joined: new Date(r.created_at).toLocaleDateString("en-IN", {
                    timeZone: "Asia/Kolkata",
                  }),
                  "Staff accounts": r.staff,
                  "Active tables": r.tables.join(", "),
                  GST: r.tax_percent + "%",
                  Discount: r.discount_percent + "%",
                  "UPI address": r.upi_id,
                }).map(([k, v]) => (
                  <div key={k}>
                    <dt>{k}</dt>
                    <dd>{v || (v === 0 ? "0" : "—")}</dd>
                  </div>
                ))}
              </dl>
              <h3>Dish inventory</h3>
              {r.dishes.length ? (
                <ul>
                  {r.dishes.map((d, i) => (
                    <li key={i}>
                      <div>
                        <b>{d.name}</b>
                        <small>
                          {d.category || "Uncategorised"} ·{" "}
                          {d.veg ? "Veg" : "Non-veg"} ·{" "}
                          {d.available ? "Available" : "Unavailable"}
                        </small>
                      </div>
                      {money(d.price)}
                    </li>
                  ))}
                </ul>
              ) : (
                <p>No dishes added yet.</p>
              )}
            </div>
          </details>
        ))}
        {!filtered.length && (
          <p>
            {rows.length
              ? "No restaurants match these filters."
              : "No restaurants registered yet."}
          </p>
        )}
        {(query || status !== "all") && (
          <button
            className="admin-action"
            onClick={() => {
              setQuery("");
              setStatus("all");
            }}
          >
            Clear filters
          </button>
        )}
      </section>
      <Ads/>
      <footer>
        Revenue includes orders marked paid during the selected period. Visits
        count valid table menu opens, including shared links, once per visitor
        and table per five-minute window. Tracking begins with this update.
      </footer>
    </main>
  );
}

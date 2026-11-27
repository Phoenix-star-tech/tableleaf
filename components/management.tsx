"use client";
import { useEffect, useState } from "react";
import QRCode from "qrcode";
import {
  Plus,
  Pencil,
  Trash2,
  Download,
  Upload,
  Check,
  QrCode,
} from "lucide-react";
import { db } from "@/lib/supabase/client";
import {
  type Restaurant,
  type Food,
  type Category,
  type Table,
  money,
} from "@/lib/types";
type Props = { restaurant: Restaurant; onError: (s: string) => void };
async function upload(file: File, rid: string) {
  if (
    !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
    file.size > 5 * 1024 * 1024
  )
    throw Error("Choose a JPG, PNG or WebP image under 5 MB.");
  const ext = file.type.split("/")[1],
    path = rid + "/" + crypto.randomUUID() + "." + ext;
  const { error } = await db()
    .storage.from("restaurant-media")
    .upload(path, file, { contentType: file.type, upsert: false });
  if (error) throw error;
  return db().storage.from("restaurant-media").getPublicUrl(path).data
    .publicUrl;
}
const blank = {
  name: "",
  name_te: "",
  name_hi: "",
  description: "",
  price: 0,
  category_id: "",
  photo_url: "",
  is_veg: true,
  available: true,
};
export function MenuManager({ restaurant: r, onError }: Props) {
  const [foods, setFoods] = useState<Food[]>([]),
    [categories, setCategories] = useState<Category[]>([]),
    [editing, setEditing] = useState<string | null>(null),
    [saveError, setSaveError] = useState(""),
    [form, setForm] = useState(blank),
    [open, setOpen] = useState(false),
    [busy, setBusy] = useState(false),
    [category, setCategory] = useState(""),
    [file, setFile] = useState<File | null>(null);
  async function load() {
    const [f, c] = await Promise.all([
      db()
        .from("menu_items")
        .select("*")
        .eq("restaurant_id", r.id)
        .order("name"),
      db()
        .from("categories")
        .select("*")
        .eq("restaurant_id", r.id)
        .order("sort_order"),
    ]);
    if (f.error || c.error) onError((f.error || c.error)!.message);
    setFoods(f.data || []);
    setCategories(c.data || []);
  }
  useEffect(() => {
    load();
  }, [r.id]);
  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaveError("");
    setBusy(true);
    try {
      const photo = file ? await upload(file, r.id) : form.photo_url;
      const payload = {
        ...form,
        restaurant_id: r.id,
        category_id: form.category_id || null,
        photo_url: photo || null,
      };
      const { error } = editing
        ? await db()
            .from("menu_items")
            .update(payload)
            .eq("id", editing)
            .eq("restaurant_id", r.id)
        : await db().from("menu_items").insert(payload);
      if (error) throw error;
      setOpen(false);
      setFile(null);
      await load();
    } catch (e) {
      setSaveError((e as Error).message);
      onError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="section-heading">
        <h2>Your menu, made with love.</h2>
        <button
          className="primary"
          onClick={() => {
            setForm(blank);
            setEditing(null);
            setFile(null);
            setOpen(true);
          }}
        >
          <Plus size={17} />
          Add dish
        </button>
      </div>
      <form
        className="inline-form"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          const { error } = await db().from("categories").insert({
            restaurant_id: r.id,
            name: category,
            sort_order: categories.length,
          });
          if (error) onError(error.message);
          else {
            setCategory("");
            await load();
          }
          setBusy(false);
        }}
      >
        <input
          aria-label="New category"
          required
          maxLength={80}
          placeholder="Add a category, e.g. Starters"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        />
        <button disabled={busy} className="secondary">
          Add category
        </button>
      </form>
      <div className="category-tabs">
        {categories.map((c) => (
          <span className="category-chip" key={c.id}>
            {c.name}
            <button
              aria-label={"Delete " + c.name}
              onClick={async () => {
                if (
                  !confirm(
                    "Delete category? Move its dishes to another category first.",
                  )
                )
                  return;
                const { error } = await db()
                  .from("categories")
                  .delete()
                  .eq("id", c.id);
                if (error) onError(error.message);
                else load();
              }}
            >
              ×
            </button>
          </span>
        ))}
      </div>
      <div className="menu-table">
        {foods.map((f) => (
          <div className="menu-table-row" key={f.id}>
            <div className="dish-thumb">
              {f.photo_url ? <img src={f.photo_url} alt="" /> : "🍽️"}
            </div>
            <div>
              <h3>{f.name}</h3>
              <span className="small muted">
                {categories.find((c) => c.id === f.category_id)?.name ||
                  "Uncategorised"}{" "}
                · {f.is_veg ? "Veg" : "Non-veg"}
              </span>
            </div>
            <strong>{money(f.price)}</strong>
            <button
              className={"toggle " + (f.available ? "on" : "")}
              onClick={async () => {
                const { error } = await db()
                  .from("menu_items")
                  .update({ available: !f.available })
                  .eq("id", f.id);
                if (error) onError(error.message);
                else load();
              }}
            >
              {f.available ? "Available" : "Sold out"}
            </button>
            <button
              className="icon-button"
              aria-label={"Edit " + f.name}
              onClick={() => {
                setEditing(f.id);
                setForm({
                  name: f.name,
                  name_te: f.name_te || "",
                  name_hi: f.name_hi || "",
                  description: f.description,
                  price: f.price,
                  category_id: f.category_id || "",
                  photo_url: f.photo_url || "",
                  is_veg: f.is_veg,
                  available: f.available,
                });
                setFile(null);
                setOpen(true);
              }}
            >
              <Pencil size={16} />
            </button>
            <button
              className="icon-button danger"
              aria-label={"Delete " + f.name}
              onClick={async () => {
                if (
                  confirm(
                    "Delete " +
                      f.name +
                      "? Existing order receipts are retained.",
                  )
                ) {
                  const { error } = await db()
                    .from("menu_items")
                    .delete()
                    .eq("id", f.id);
                  if (error) onError(error.message);
                  else load();
                }
              }}
            >
              <Trash2 size={16} />
            </button>
          </div>
        ))}
      </div>
      {!foods.length && (
        <div className="empty">
          <h2>A fresh start.</h2>
          <p>Add your first dish to start building your menu.</p>
        </div>
      )}
      {open && (
        <div className="modal-backdrop">
          <section
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-label={editing ? "Edit dish" : "Add dish"}
          >
            <div className="row">
              <h2>{editing ? "Edit dish" : "Something delicious"}</h2>
              <button aria-label="Close" onClick={() => setOpen(false)}>
                ×
              </button>
            </div>
            {saveError && (
              <p role="alert" className="error">
                {saveError}
              </p>
            )}
            <form onSubmit={save}>
              <label>
                Dish name
                <input
                  required
                  maxLength={150}
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </label>
              <div className="form-grid">
                <label>
                  Telugu name
                  <input
                    value={form.name_te}
                    onChange={(e) =>
                      setForm({ ...form, name_te: e.target.value })
                    }
                  />
                </label>
                <label>
                  Hindi name
                  <input
                    value={form.name_hi}
                    onChange={(e) =>
                      setForm({ ...form, name_hi: e.target.value })
                    }
                  />
                </label>
                <label>
                  Price (₹)
                  <input
                    type="number"
                    min=".01"
                    max="100000"
                    step=".01"
                    required
                    value={form.price || ""}
                    onChange={(e) =>
                      setForm({ ...form, price: Number(e.target.value) })
                    }
                  />
                </label>
                <label>
                  Category
                  <select
                    value={form.category_id}
                    onChange={(e) =>
                      setForm({ ...form, category_id: e.target.value })
                    }
                  >
                    <option value="">Uncategorised</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <label>
                Description
                <textarea
                  maxLength={500}
                  value={form.description}
                  onChange={(e) =>
                    setForm({ ...form, description: e.target.value })
                  }
                />
              </label>
              <label>
                <Upload size={15} /> Photo (JPG, PNG, WebP · up to 5 MB)
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                />
              </label>
              {form.photo_url && !file && (
                <button
                  type="button"
                  className="text-button"
                  onClick={() => setForm({ ...form, photo_url: "" })}
                >
                  Remove current photo
                </button>
              )}
              <label className="check-label">
                <input
                  type="checkbox"
                  checked={form.is_veg}
                  onChange={(e) =>
                    setForm({ ...form, is_veg: e.target.checked })
                  }
                />
                Vegetarian
              </label>
              <label className="check-label">
                <input
                  type="checkbox"
                  checked={form.available}
                  onChange={(e) =>
                    setForm({ ...form, available: e.target.checked })
                  }
                />
                Available to order
              </label>
              <button className="primary full" disabled={busy}>
                {busy ? "Saving…" : "Save dish"}
                <Check size={17} />
              </button>
            </form>
          </section>
        </div>
      )}
    </>
  );
}
function TableQR({
  r,
  table,
  onToggle,
}: {
  r: Restaurant;
  table: Table;
  onToggle: () => void;
}) {
  const [url, setUrl] = useState(""),
    [qr, setQR] = useState("");
  useEffect(() => {
    const link =
      (process.env.NEXT_PUBLIC_SITE_URL ||
        (process.env.NEXT_PUBLIC_VERCEL_ENV === "production"
          ? "https://tableleaf.vashik.in"
          : location.origin)).replace(/\/$/, "") +
      "/r/" +
      r.slug +
      "?table=" +
      table.table_no;
    setUrl(link);
    QRCode.toDataURL(link, {
      width: 800,
      margin: 3,
      errorCorrectionLevel: "H",
    }).then(setQR);
  }, [r.slug, table.table_no]);
  return (
    <article className="qr-card">
      <p className="eyebrow">{r.name}</p>
      <h2>Table {table.table_no}</h2>
      {qr && <img src={qr} alt={"Menu QR for table " + table.table_no} />}
      <p>Scan. Order. Enjoy.</p>
      <a className="small muted" href={url} target="_blank" rel="noreferrer">
        Test menu link ↗
      </a>
      <div className="actions">
        <a
          className="secondary"
          href={qr}
          download={"table-" + table.table_no + ".png"}
        >
          <Download size={14} />
          PNG
        </a>
        <button
          className="secondary"
          onClick={async () => {
            const { jsPDF } = await import("jspdf");
            const pdf = new jsPDF();
            pdf.setFontSize(24);
            pdf.text(r.name, 105, 35, { align: "center" });
            pdf.setFontSize(18);
            pdf.text("Table " + table.table_no, 105, 52, { align: "center" });
            pdf.addImage(qr, "PNG", 45, 65, 120, 120);
            pdf.setFontSize(13);
            pdf.text("Scan. Order. Enjoy.", 105, 200, { align: "center" });
            pdf.setFontSize(9);
            pdf.text(pdf.splitTextToSize(url, 170), 20, 220);
            pdf.save("table-" + table.table_no + ".pdf");
          }}
        >
          PDF / Print
        </button>
      </div>
      <button
        className={"toggle " + (table.active ? "on" : "")}
        onClick={onToggle}
      >
        {table.active ? "Active · Disable" : "Inactive · Enable"}
      </button>
    </article>
  );
}
export function TablesManager({ restaurant: r, onError }: Props) {
  const [tables, setTables] = useState<Table[]>([]),
    [number, setNumber] = useState(1),
    [busy, setBusy] = useState(false);
  async function load() {
    const { data, error } = await db()
      .from("tables")
      .select("*")
      .eq("restaurant_id", r.id)
      .order("table_no");
    if (error) onError(error.message);
    else setTables(data || []);
  }
  useEffect(() => {
    load();
  }, [r.id]);
  return (
    <>
      <div className="info">
        <QrCode size={22} />
        <p>
          Give every table its own menu. Download a PNG or a printable PDF. Set
          your final site URL before printing.
        </p>
      </div>
      <form
        className="inline-form"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          const { error } = await db()
            .from("tables")
            .insert({ restaurant_id: r.id, table_no: number });
          if (error) onError(error.message);
          else {
            setNumber((n) => n + 1);
            await load();
          }
          setBusy(false);
        }}
      >
        <label>
          Table number
          <input
            type="number"
            min="1"
            max="9999"
            required
            value={number}
            onChange={(e) => setNumber(Number(e.target.value))}
          />
        </label>
        <button disabled={busy} className="primary">
          <Plus size={16} />
          Create table
        </button>
      </form>
      <div className="qr-grid">
        {tables.map((t) => (
          <TableQR
            key={t.id}
            r={r}
            table={t}
            onToggle={async () => {
              const { error } = await db()
                .from("tables")
                .update({ active: !t.active })
                .eq("id", t.id);
              if (error) onError(error.message);
              else load();
            }}
          />
        ))}
      </div>
    </>
  );
}
export function SettingsManager({
  restaurant: r,
  onError,
  onSave,
}: Props & { onSave: (r: Restaurant) => void }) {
  const [form, setForm] = useState(r),
    [file, setFile] = useState<File | null>(null),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    setForm(r);
  }, [r]);
  return (
    <form
      className="settings-form panel"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        try {
          const logo = file ? await upload(file, r.id) : form.logo_url;
          const { data, error } = await db()
            .from("restaurants")
            .update({
              name: form.name,
              logo_url: logo,
              theme_color: form.theme_color,
              is_open: form.is_open,
              tax_percent: form.tax_percent,
              discount_percent: form.discount_percent,
              upi_id: form.upi_id || null,
            })
            .eq("id", r.id)
            .select("*")
            .single();
          if (error) throw error;
          onSave(data);
          setFile(null);
        } catch (e) {
          onError((e as Error).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <h2>The little details matter.</h2>
      <label>
        Restaurant name
        <input
          required
          maxLength={100}
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
        />
      </label>
      <label>
        Menu URL
        <input readOnly value={"/r/" + r.slug} />
      </label>
      <div className="form-grid">
        <label>
          Tax / GST %
          <input
            required
            type="number"
            min="0"
            max="100"
            step=".01"
            value={form.tax_percent}
            onChange={(e) =>
              setForm({ ...form, tax_percent: Number(e.target.value) })
            }
          />
        </label>
        <label>
          Discount %
          <input
            required
            type="number"
            min="0"
            max="100"
            step=".01"
            value={form.discount_percent}
            onChange={(e) =>
              setForm({ ...form, discount_percent: Number(e.target.value) })
            }
          />
        </label>
      </div>
      <p className="small muted">
        Prices exclude tax. Discount is applied before tax. Existing orders keep
        their original totals. Set your applicable tax with your accountant.
      </p>
      <label>
        UPI ID
        <input
          placeholder="restaurant@bank"
          pattern="[^\s@]+@[^\s@]+"
          value={form.upi_id || ""}
          onChange={(e) => setForm({ ...form, upi_id: e.target.value })}
        />
      </label>
      <label>
        Theme colour
        <input
          type="color"
          value={form.theme_color}
          onChange={(e) => setForm({ ...form, theme_color: e.target.value })}
        />
      </label>
      <label>
        Restaurant logo
        <input
          type="file"
          accept="image/png,image/jpeg,image/webp"
          onChange={(e) => setFile(e.target.files?.[0] || null)}
        />
      </label>
      <label className="check-label">
        <input
          type="checkbox"
          checked={form.is_open}
          onChange={(e) => setForm({ ...form, is_open: e.target.checked })}
        />
        Kitchen open for orders
      </label>
      <button className="primary" disabled={busy}>
        {busy ? "Saving…" : "Save settings"}
        <Check size={16} />
      </button>
    </form>
  );
}
export function StaffManager({ restaurant: r, onError }: Props) {
  const [email, setEmail] = useState(""),
    [role, setRole] = useState("kitchen"),
    [members, setMembers] = useState<{ user_id: string; role: string }[]>([]),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  async function load() {
    const { data, error } = await db()
      .from("staff")
      .select("*")
      .eq("restaurant_id", r.id);
    if (error) onError(error.message);
    else setMembers(data || []);
  }
  useEffect(() => {
    load();
  }, [r.id]);
  async function change(remove: boolean) {
    setBusy(true);
    const { error } = await db().rpc("manage_staff", {
      restaurant_id: r.id,
      email_address: email,
      staff_role: role,
      remove_member: remove,
    });
    if (error) onError(error.message);
    else {
      setMessage(remove ? "Access removed." : "Staff access saved.");
      await load();
    }
    setBusy(false);
  }
  return (
    <section className="panel settings-form">
      <h2>Good service is a team sport.</h2>
      <p className="muted">
        Create an email/password user in Supabase → Authentication → Users
        first. Then assign their email below. Kitchen staff can process orders;
        owners can manage settings and confirm payments.
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          change(false);
        }}
      >
        <label>
          Staff email
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>
        <label>
          Role
          <select value={role} onChange={(e) => setRole(e.target.value)}>
            <option value="kitchen">Kitchen</option>
            <option value="owner">Owner</option>
          </select>
        </label>
        <div className="actions">
          <button disabled={busy} className="primary">
            Save access
          </button>
          <button
            type="button"
            disabled={busy || !email}
            className="secondary"
            onClick={() => {
              if (confirm("Remove this account’s restaurant access?"))
                change(true);
            }}
          >
            Remove access
          </button>
        </div>
      </form>
      {message && <p role="status">{message}</p>}
      <h3 className="mt-6">Team members</h3>
      <p className="small muted">Primary owner: {r.owner_id}</p>
      {members.map((m) => (
        <div className="row small" key={m.user_id}>
          <code>{m.user_id}</code>
          <span className="status">{m.role}</span>
        </div>
      ))}
    </section>
  );
}
type Report = {
  sales: number;
  count: number;
  average: number;
  tax: number;
  discount: number;
  daily: { day: string; total: number; count: number }[];
  top: { name: string; quantity: number; sales: number }[];
};
export function Reports({ restaurant: r, onError }: Props) {
  const today = new Date().toLocaleDateString("en-CA", {
    timeZone: "Asia/Kolkata",
  });
  const [from, setFrom] = useState(today),
    [to, setTo] = useState(today),
    [data, setData] = useState<Report | null>(null),
    [busy, setBusy] = useState(false);
  async function load() {
    setBusy(true);
    const { data, error } = await db().rpc("sales_report", {
      restaurant_id: r.id,
      start_day: from,
      end_day: to,
    });
    if (error) onError(error.message);
    else setData(data);
    setBusy(false);
  }
  useEffect(() => {
    load();
  }, [r.id]);
  return (
    <>
      <form
        className="filters"
        onSubmit={(e) => {
          e.preventDefault();
          load();
        }}
      >
        <label>
          From
          <input
            required
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
        </label>
        <label>
          Through
          <input
            required
            min={from}
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
        </label>
        <button className="primary" disabled={busy}>
          {busy ? "Loading…" : "Update report"}
        </button>
      </form>
      <p className="small muted">
        Confirmed payments only · Payment date in Asia/Kolkata · Maximum 366
        days
      </p>
      {data && (
        <>
          <div className="stats-grid">
            <div>
              <span>Sales incl. tax</span>
              <strong>{money(data.sales)}</strong>
            </div>
            <div>
              <span>Paid orders</span>
              <strong>{data.count}</strong>
            </div>
            <div>
              <span>Average bill</span>
              <strong>{money(data.average)}</strong>
            </div>
            <div>
              <span>Tax collected</span>
              <strong>{money(data.tax)}</strong>
              <span>Discounts: {money(data.discount)}</span>
            </div>
          </div>
          <div className="report-grid">
            <section className="panel">
              <h2>Daily sales</h2>
              {data.daily.length ? (
                data.daily.map((d) => (
                  <div key={d.day} className="report-line">
                    <div className="row">
                      <span>
                        {d.day} · {d.count} orders
                      </span>
                      <b>{money(d.total)}</b>
                    </div>
                    <div className="bar">
                      <span
                        style={{
                          width:
                            (d.total /
                              Math.max(
                                ...data.daily.map((x) => Number(x.total)),
                                1,
                              )) *
                              100 +
                            "%",
                        }}
                      />
                    </div>
                  </div>
                ))
              ) : (
                <p>No confirmed payments in this range.</p>
              )}
            </section>
            <section className="panel">
              <h2>The table favourites</h2>
              <p className="small muted">
                Item revenue before order discounts and tax.
              </p>
              {data.top.map((i, n) => (
                <div className="top-item" key={i.name}>
                  <span className="rank">{n + 1}</span>
                  <div>
                    <strong>{i.name}</strong>
                    <p className="muted small">{i.quantity} portions</p>
                  </div>
                  <b>{money(i.sales)}</b>
                </div>
              ))}
            </section>
          </div>
        </>
      )}
    </>
  );
}

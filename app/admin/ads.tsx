"use client";
import { useEffect, useState, type FormEvent } from "react";
import LocationSearch, { type Place } from "@/components/location-search";
import { db } from "@/lib/supabase/client";
type Ad = {
  id: string;
  title: string;
  image_path: string;
  starts_at: string;
  ends_at: string;
  location_name: string | null;
  destination_url: string | null;
};
function localMinute(date: Date) {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export default function Ads() {
  const [now, setNow] = useState<Date | null>(null);
  const [startValue, setStartValue] = useState("");
  const today = now ? localMinute(now).slice(0, 10) + "T00:00" : undefined;
  const earliestEnd = now
    ? localMinute(new Date(Math.max(now.getTime(), Date.parse(startValue) || 0) + 60000))
    : undefined;
  const [ads, setAds] = useState<Ad[]>([]),
    [city, setCity] = useState<Place | null>(null),
    [target, setTarget] = useState("all"),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  async function load() {
    const { data, error } = await db()
      .from("menu_ads")
      .select("*")
      .order("starts_at", { ascending: false });
    if (error) setMessage(error.message);
    else setAds(data ?? []);
  }
  useEffect(() => {
    void load();
    const updateClock = () => setNow(new Date());
    updateClock();
    const timer = setInterval(updateClock, 30000);
    window.addEventListener("focus", updateClock);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", updateClock);
    };
  }, []);
  async function publish(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget,
      data = new FormData(form),
      image = data.get("image") as File;
    const start = new Date(String(data.get("start"))),
      end = new Date(String(data.get("end")));
    const midnight = new Date();
    midnight.setHours(0, 0, 0, 0);
    if (start < midnight) {
      setMessage("Choose today or a later date for the start.");
      return;
    }
    if (!(end > start) || end.getTime() <= Date.now()) {
      setMessage("Choose an end time after the start and in the future.");
      return;
    }
    if (target === "city" && !city) {
      setMessage("Choose a city from the search results.");
      return;
    }
    if (
      !["image/png", "image/jpeg", "image/webp"].includes(image.type) ||
      image.size > 5242880
    ) {
      setMessage("Choose a PNG, JPG or WebP image up to 5 MB.");
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      const client = db(),
        bucket = client.storage.from("menu-ads"),
        path = crypto.randomUUID() + "." + image.type.split("/")[1];
      const upload = await bucket.upload(path, image);
      if (upload.error) throw upload.error;
      const result = await client.from("menu_ads").insert({
        title: String(data.get("title")).trim(),
        image_path: path,
        destination_url:
          String(data.get("destination_url") || "").trim() || null,
        location_id: target === "city" ? city?.id : null,
        location_name: target === "city" ? city?.label : null,
        starts_at: start.toISOString(),
        ends_at: end.toISOString(),
      });
      if (result.error) {
        await bucket.remove([path]);
        throw result.error;
      }
      form.reset();
      setStartValue("");
      setCity(null);
      setTarget("all");
      setMessage("Ad scheduled.");
      await load();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Could not save the ad.");
    } finally {
      setBusy(false);
    }
  }
  async function remove(ad: Ad) {
    if (!window.confirm("Remove this ad from the schedule?")) return;
    setBusy(true);
    try {
      const client = db();
      const { error } = await client.from("menu_ads").delete().eq("id", ad.id);
      if (error) throw error;
      const image = await client.storage
        .from("menu-ads")
        .remove([ad.image_path]);
      setMessage(
        image.error ? "Ad removed. Image cleanup failed." : "Ad removed.",
      );
      await load();
    } catch {
      setMessage("Could not remove the ad.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="directory">
      <h2>Menu advertising</h2>
      <form className="ad-form" onSubmit={publish}>
        <label>
          Ad title
          <input name="title" required maxLength={100} />
        </label>
        <label>
          Destination URL (optional)
          <input
            type="url"
            name="destination_url"
            pattern="https?://.+"
            maxLength={2048}
            placeholder="https://example.com/offer"
            title="Enter a link starting with https:// or http://"
          />
        </label>
        <label>
          Artwork · JPG, PNG or WebP, up to 5 MB
          <input
            type="file"
            name="image"
            required
            accept="image/jpeg,image/png,image/webp"
          />
        </label>
        <label>
          Starts
          <input type="datetime-local" name="start" min={today} required
            value={startValue} onChange={e => setStartValue(e.target.value)} />
        </label>
        <label>
          Ends
          <input type="datetime-local" name="end" min={earliestEnd} required />
        </label>
        <small>
          Times use {Intl.DateTimeFormat().resolvedOptions().timeZone}.
        </small>
        <label>
          Audience
          <select value={target} onChange={(e) => setTarget(e.target.value)}>
            <option value="all">All restaurant locations</option>
            <option value="city">Selected city or town</option>
          </select>
        </label>
        {target === "city" && (
          <LocationSearch value={city} onChange={setCity} />
        )}
        <button className="primary" disabled={busy}>
          Schedule ad
        </button>
      </form>
      <p role="status">{message}</p>
      <h3>Ad schedule</h3>
      {!ads.length && <p>No ads scheduled.</p>}
      {ads.map((ad) => (
        <div className="ad-list-row" key={ad.id}>
          <div>
            <b>{ad.title}</b>
            {ad.destination_url && (
              <small>
                <a
                  href={ad.destination_url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Open destination ↗
                </a>
              </small>
            )}
            <small>
              {ad.location_name ?? "All locations"} ·{" "}
              {new Date(ad.starts_at).toLocaleString()} –{" "}
              {new Date(ad.ends_at).toLocaleString()}
            </small>
          </div>
          <button
            className="admin-action"
            disabled={busy}
            onClick={() => remove(ad)}
          >
            Remove
          </button>
        </div>
      ))}
    </section>
  );
}

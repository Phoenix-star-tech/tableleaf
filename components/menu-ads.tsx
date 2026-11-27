"use client";
import { useEffect, useState } from "react";
import { db } from "@/lib/supabase/client";
type Ad = {
  id: string;
  title: string;
  image_path: string;
  ends_at: string;
  destination_url: string | null;
};
export default function MenuAds({ restaurant }: { restaurant: string }) {
  const [ads, setAds] = useState<Ad[]>([]);
  const [position, setPosition] = useState(0);
  const [paused, setPaused] = useState(false);
  const [focused, setFocused] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  useEffect(() => {
    if (ads.length < 2 || paused || focused || hovered || reducedMotion) return;
    const timer = setInterval(
      () => setPosition((i) => (i + 1) % ads.length),
      6000,
    );
    return () => clearInterval(timer);
  }, [ads.length, paused, focused, hovered, reducedMotion]);
  useEffect(() => {
    let active = true;
    const client = db();
    async function refresh() {
      const { data } = await client.rpc("active_menu_ads", { restaurant });
      if (active) setAds(data ?? []);
    }
    void refresh();
    const timer = setInterval(refresh, 15000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [restaurant]);
  useEffect(() => {
    if (!ads.length) return;
    const expiry = Math.min(...ads.map((a) => Date.parse(a.ends_at)));
    const timer = setTimeout(
      () =>
        setAds((list) =>
          list.filter((a) => Date.parse(a.ends_at) > Date.now()),
        ),
      Math.min(2147483647, Math.max(0, expiry - Date.now())),
    );
    return () => clearTimeout(timer);
  }, [ads]);
  if (!ads.length) return null;
  const index = position % ads.length;
  const ad = ads[index];
  const image = (
    <img
      alt={ad.title}
      src={
        db().storage.from("menu-ads").getPublicUrl(ad.image_path).data.publicUrl
      }
    />
  );
  return (
    <section
      className="menu-ad"
      aria-label="Sponsored offers"
      aria-roledescription="carousel"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setFocused(true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) setFocused(false);
      }}
    >
      <figure style={{ margin: 0 }}>
        {ad.destination_url ? (
          <a
            href={ad.destination_url}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={ad.title + " (opens in a new tab)"}
          >
            {image}
            <figcaption>Sponsored · {ad.title} ↗</figcaption>
          </a>
        ) : (
          <>
            {image}
            <figcaption>Sponsored · {ad.title}</figcaption>
          </>
        )}
      </figure>
      {ads.length > 1 && (
        <div className="ad-controls">
          <button
            type="button"
            aria-label="Previous ad"
            onClick={() => setPosition((index + ads.length - 1) % ads.length)}
          >
            ‹
          </button>
          <span>
            {index + 1} / {ads.length}
          </span>
          <button
            type="button"
            aria-label="Next ad"
            onClick={() => setPosition((index + 1) % ads.length)}
          >
            ›
          </button>
          {!reducedMotion && (
            <button type="button" onClick={() => setPaused(!paused)}>
              {paused ? "Resume" : "Pause"}
            </button>
          )}
        </div>
      )}
    </section>
  );
}

"use client";
import { useEffect, useId, useState } from "react";
export type Place = { id: number; label: string };
type Result = { id: number; name: string; admin1?: string; country?: string };
export default function LocationSearch({
  value,
  onChange,
}: {
  value: Place | null;
  onChange: (p: Place | null) => void;
}) {
  const [query, setQuery] = useState(""),
    [places, setPlaces] = useState<Place[]>([]),
    [message, setMessage] = useState("");
  const id = useId();
  useEffect(() => {
    if (value || query.trim().length < 2) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        setMessage("Searching…");
        const response = await fetch(
          "https://geocoding-api.open-meteo.com/v1/search?count=8&language=en&name=" +
            encodeURIComponent(query.trim()),
          { signal: controller.signal },
        );
        if (!response.ok) throw Error();
        const data = await response.json();
        const matches = (data.results ?? []).map((p: Result) => ({
          id: p.id,
          label: [
            ...new Set([p.name, p.admin1, p.country].filter(Boolean)),
          ].join(", "),
        }));
        if (!controller.signal.aborted) {
          setPlaces(matches);
          setMessage(matches.length ? "" : "No matches. Try a nearby city.");
        }
      } catch {
        if (!controller.signal.aborted)
          setMessage("Search unavailable. Edit your search to try again.");
      }
    }, 350);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, value]);
  return (
    <div className="city-picker">
      <label htmlFor={id}>City or town</label>
      <input
        id={id}
        type="search"
        required
        autoComplete="off"
        placeholder="Search for a city or town"
        value={value?.label ?? query}
        onChange={(e) => {
          onChange(null);
          setQuery(e.target.value);
          setPlaces([]);
          setMessage("");
        }}
      />
      {places.length > 0 && !value && (
        <div className="city-results" aria-label="Matching locations">
          {places.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => {
                onChange(p);
                setQuery("");
                setPlaces([]);
                setMessage("");
              }}
            >
              {p.label}
            </button>
          ))}
        </div>
      )}
      <small role="status">{message}</small>
      <small>
        Location data:{" "}
        <a href="https://open-meteo.com/en/docs/geocoding-api">
          Open-Meteo / GeoNames
        </a>
      </small>
    </div>
  );
}

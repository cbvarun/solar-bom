"use client";
import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { polygonAreaM2 } from "@/lib/engine";

export type LatLon = [number, number];

// Map view only; not a project default. Used when no site has been marked yet.
const BENGALURU: LatLon = [12.9716, 77.5946];
/** OpenStreetMap standard tiles. Fine for light use; switch provider here for heavy traffic. */
const TILE_URL = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";

/**
 * OpenStreetMap map (free, attribution required) for marking the site and
 * drawing the roof outline. Place search uses Nominatim on the visitor's own
 * request only, within its usage policy.
 */
export function SiteMap({ pin, outline, onPin, onOutline, readOnly }: {
  pin: LatLon | null;
  outline: LatLon[];
  onPin: (p: LatLon) => void;
  onOutline: (pts: LatLon[]) => void;
  readOnly?: boolean;
}) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const layers = useRef<{ pin?: L.CircleMarker; poly?: L.Polygon; vertices?: L.LayerGroup }>({});
  const [mode, setMode] = useState<"pin" | "outline">(pin ? "outline" : "pin");
  const modeRef = useRef(mode);
  modeRef.current = mode;
  const state = useRef({ outline, onPin, onOutline });
  state.current = { outline, onPin, onOutline };
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<{ label: string; at: LatLon }[]>([]);
  const [searchMsg, setSearchMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!el.current || map.current) return;
    const m = L.map(el.current, { center: pin ?? BENGALURU, zoom: pin ? 19 : 12, maxZoom: 19 });
    L.tileLayer(TILE_URL, {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(m);
    if (!readOnly) {
      m.on("click", (e: L.LeafletMouseEvent) => {
        const p: LatLon = [Number(e.latlng.lat.toFixed(6)), Number(e.latlng.lng.toFixed(6))];
        if (modeRef.current === "pin") state.current.onPin(p);
        else state.current.onOutline([...state.current.outline, p]);
      });
    }
    map.current = m;
    return () => { m.remove(); map.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const m = map.current;
    if (!m) return;
    layers.current.pin?.remove();
    if (pin) layers.current.pin = L.circleMarker(pin, { radius: 8, color: "#163527", weight: 3, fillColor: "#f5c02c", fillOpacity: 1 }).addTo(m);
  }, [pin]);

  useEffect(() => {
    const m = map.current;
    if (!m) return;
    layers.current.poly?.remove();
    layers.current.vertices?.remove();
    if (outline.length >= 2) layers.current.poly = L.polygon(outline, { color: "#163527", weight: 2, fillColor: "#f5c02c", fillOpacity: 0.25 }).addTo(m);
    layers.current.vertices = L.layerGroup(outline.map((p) => L.circleMarker(p, { radius: 3, color: "#163527", weight: 2, fillOpacity: 1 }))).addTo(m);
  }, [outline]);

  async function search(e: React.FormEvent) {
    e.preventDefault();
    if (query.trim().length < 3) return;
    setSearchMsg("Searching…");
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&countrycodes=in&q=${encodeURIComponent(query.trim())}`, { headers: { "accept-language": "en" } });
      const rows = (await res.json()) as { display_name: string; lat: string; lon: string }[];
      setResults(rows.map((r) => ({ label: r.display_name, at: [Number(r.lat), Number(r.lon)] as LatLon })));
      setSearchMsg(rows.length ? null : "No places found. Try a locality or landmark.");
    } catch {
      setSearchMsg("Place search is unavailable right now. Move the map by hand instead.");
    }
  }

  function goTo(at: LatLon) {
    map.current?.setView(at, 19);
    setResults([]);
  }

  const area = polygonAreaM2(outline);
  return (
    <div>
      {!readOnly && (
        <form onSubmit={search} className="flex flex-wrap gap-2" role="search">
          <label htmlFor="site-search" className="sr-only">Find a place</label>
          <input id="site-search" className="input min-w-0 flex-1" placeholder="Find a place, e.g. HSR Layout Sector 2" value={query} onChange={(e) => setQuery(e.target.value)} />
          <button className="btn-secondary">Search</button>
          <button type="button" className="btn-ghost" onClick={() => navigator.geolocation?.getCurrentPosition((p) => goTo([p.coords.latitude, p.coords.longitude]), () => setSearchMsg("Location permission was not granted."))}>Use my location</button>
        </form>
      )}
      {searchMsg && <p className="mt-1 text-xs text-ink-muted">{searchMsg}</p>}
      {results.length > 0 && (
        <ul className="mt-1 max-h-40 overflow-auto rounded border border-slate-200 bg-white text-sm">
          {results.map((r) => <li key={r.label}><button type="button" className="block w-full px-3 py-1.5 text-left hover:bg-slate-50" onClick={() => goTo(r.at)}>{r.label}</button></li>)}
        </ul>
      )}
      {!readOnly && (
        <div className="mt-3 flex flex-wrap items-center gap-2 text-sm" role="group" aria-label="Map tool">
          <button type="button" aria-pressed={mode === "pin"} className={mode === "pin" ? "btn-primary" : "btn-secondary"} onClick={() => setMode("pin")}>Mark site</button>
          <button type="button" aria-pressed={mode === "outline"} className={mode === "outline" ? "btn-primary" : "btn-secondary"} onClick={() => setMode("outline")}>Draw roof outline</button>
          {mode === "outline" && (
            <>
              <button type="button" className="btn-ghost" disabled={!outline.length} onClick={() => onOutline(outline.slice(0, -1))}>Undo point</button>
              <button type="button" className="btn-ghost" disabled={!outline.length} onClick={() => onOutline([])}>Clear outline</button>
            </>
          )}
        </div>
      )}
      <p className="mt-2 text-xs text-ink-muted">
        {readOnly ? "Site location and roof outline." : mode === "pin" ? "Click the map where the installation is." : "Click each corner of the usable roof area in turn. The shape closes automatically."}
      </p>
      <div ref={el} className="mt-2 h-[360px] w-full rounded-md border border-slate-200 sm:h-[440px]" role="application" aria-label="Site map" />
      <p className="mt-2 text-sm">
        {outline.length >= 3 ? <>Outline area: <strong className="tabular-nums">{area.toFixed(1)} m²</strong> <span className="text-xs text-ink-muted">(approximate, measured on the map; confirm on site)</span></> : <span className="text-xs text-ink-muted">No roof outline drawn.</span>}
      </p>
    </div>
  );
}

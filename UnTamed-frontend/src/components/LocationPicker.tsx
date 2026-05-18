// src/components/LocationPicker.tsx
import { useEffect, useMemo, useRef, useState } from "react";
import type { AddressResponse } from "../types/geo";
import { geoPopular, geoAutocomplete, geoReverse } from "../api/geo.api";
import { useDebounce } from "../hooks/useDebounce";
import MapPicker from "./MapPicker";
import styles from "../style/locationPicker.module.css";

type Props = {
  value: AddressResponse | null;
  onChange: (v: AddressResponse | null) => void;
  label?: string;
  placeholder?: string;
};

export default function LocationPicker({ value, onChange, label = "Location", placeholder = "Start typing an address..." }: Props) {
  const [query, setQuery] = useState<string>(value?.displayName ?? "");
  const debounced = useDebounce(query, 350);

  const [results, setResults] = useState<AddressResponse[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [mapCenter, setMapCenter] = useState({
    lat: value?.latitude ?? 36.8065,
    lon: value?.longitude ?? 10.1815,
  });
  const [mapZoom, setMapZoom] = useState(value ? 15 : 11);

  // ── FIX 1: ref to detect outside clicks ────────────────────────────────────
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onOutsideClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onOutsideClick);
    return () => document.removeEventListener("mousedown", onOutsideClick);
  }, []);

  // Escape key closes dropdown
  useEffect(() => {
    function onEscape(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onEscape);
    return () => document.removeEventListener("keydown", onEscape);
  }, []);

  // Sync input label when parent value changes
  useEffect(() => {
    if (!value) return;
    setQuery(value.displayName);
    setMapCenter({ lat: value.latitude, lon: value.longitude });
    setMapZoom(15);
  }, [value]);

  const canSearch = useMemo(() => debounced.trim().length >= 3, [debounced]);

  const uniqueResults = useMemo(() => {
    const seen = new Set<string>();
    const out: AddressResponse[] = [];
    for (const r of results) {
      const key = r.id || `${r.provider}:${r.providerPlaceId}:${r.latitude}:${r.longitude}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(r);
    }
    return out;
  }, [results]);

  async function loadPopularIfEmpty() {
    if (query.trim().length > 0) return;
    try {
      setLoading(true);
      const data = await geoPopular();
      setResults(data);
      setOpen(true);
      setErr(null);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to load popular locations");
      setResults([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let alive = true;
    async function run() {
      setErr(null);
      if (value && query === value.displayName) return;
      if (!canSearch) {
        setResults([]);
        setOpen(false);
        return;
      }
      try {
        setLoading(true);
        const data = await geoAutocomplete(debounced.trim(), 10);
        if (!alive) return;
        setResults(data);
        setOpen(true);
      } catch (e) {
        if (!alive) return;
        setErr(e instanceof Error ? e.message : "Search failed");
        setResults([]);
        setOpen(false);
      } finally {
        if (alive) setLoading(false);
      }
    }
    run();
    return () => { alive = false; };
  }, [debounced, canSearch, value, query]);

  function pick(item: AddressResponse) {
    onChange(item);
    setQuery(item.displayName);
    setOpen(false);
    setResults([]);
    setErr(null);
    setMapCenter({ lat: item.latitude, lon: item.longitude });
    setMapZoom(15);
  }

  // ── FIX 2: clear resets everything ─────────────────────────────────────────
  function clear() {
    onChange(null);
    setQuery("");
    setOpen(false);
    setResults([]);
    setErr(null);
    setMapCenter({ lat: 36.8065, lon: 10.1815 });
    setMapZoom(11);
  }

  async function pickFromMap(lat: number, lon: number) {
    try {
      setErr(null);
      setLoading(true);
      const addr = await geoReverse(lat, lon, 18);
      onChange(addr);
      setQuery(addr.displayName);
      setOpen(false);
      setResults([]);
      setMapCenter({ lat, lon });
      setMapZoom(15);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Reverse geocoding failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={styles.locationPickerContainer} ref={containerRef}>

      {/* Header: label + clear — always rendered ──────────────────────────── */}
      <div className={styles.pickerHeader}>
        <label className={styles.pickerLabel}>{label}</label>
        {value && (
          <button type="button" onClick={clear} className={styles.clearBtn} title="Clear location" aria-label="Clear location">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
            Clear
          </button>
        )}
      </div>

      <div className={styles.locationPickerGrid}>
        {/* Search panel — always visible, never collapses after map pick ───── */}
        <div className={styles.searchPanel}>
          <div className={styles.inputWrapper}>
            <span className={styles.searchIcon}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.35-4.35" />
              </svg>
            </span>

            <input
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                if (value) onChange(null);   // typing clears existing selection
              }}
              onFocus={() => {
                // Only re-open if no value selected yet
                if (uniqueResults.length > 0 && !value) setOpen(true);
                loadPopularIfEmpty();
              }}
              placeholder={placeholder}
              className={`${styles["locationInput"]} ${value ? styles["location-input--selected"] : ""}`}
              aria-autocomplete="list"
              aria-expanded={open}
            />

            {/* Spinner while searching */}
            {loading && (
              <span className={styles.loadingSpinner}>
                <div className={styles.spinnerIcon} />
              </span>
            )}

            {/* ── FIX 2b: inline ✕ inside the input field when location chosen */}
            {value && !loading && (
              <button
                type="button"
                className={styles.inputClearBtn}
                onClick={clear}
                aria-label="Clear location"
                title="Clear location"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            )}
          </div>

          {/* Status */}
          <div className={styles.pickerStatus}>
            {loading ? (
              <span className={styles.statusLoading}>🔍 Searching...</span>
            ) : err ? (
              <span className={styles.statusError}>⚠️ {err}</span>
            ) : value ? (
              <span className={styles.statusSuccess}>✅ Location selected</span>
            ) : (
              <span className={styles.statusHint}>Type to search or click on map</span>
            )}
          </div>

          {/* Dropdown — only when open AND no value committed yet ─────────── */}
          {open && !value && uniqueResults.length > 0 && (
            <div className={styles.resultsDropdown} role="listbox">
              {/* Topbar with count + explicit close button ────────────────── */}
              <div className={styles.dropdownTopbar}>
                <span className={styles.dropdownCount}>
                  {uniqueResults.length} suggestion{uniqueResults.length !== 1 ? "s" : ""}
                </span>
                <button
                  type="button"
                  className={styles.dropdownCloseBtn}
                  onClick={() => setOpen(false)}
                  aria-label="Close suggestions"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>

                <div className={styles.resultsList}>
                {uniqueResults.map((r) => (
                  <button
                    key={r.id || `${r.provider}:${r.providerPlaceId}:${r.latitude}:${r.longitude}`}
                    type="button"
                    role="option"
                    onClick={() => pick(r)}
                    onMouseEnter={() => setMapCenter({ lat: r.latitude, lon: r.longitude })}
                    className={styles.resultItem}
                  >
                    <div className={styles.resultIcon}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                        stroke="currentColor" strokeWidth="2">
                        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                        <circle cx="12" cy="10" r="3" />
                      </svg>
                    </div>
                    <div className={styles.resultContent}>
                      <div className={styles.resultName}>{r.displayName}</div>
                      <div className={styles.resultCoords}>
                        {r.latitude.toFixed(5)}, {r.longitude.toFixed(5)}
                        {typeof r.usesCount === "number" && r.usesCount > 0 && (
                          <span className={styles.usesBadge}>• {r.usesCount} uses</span>
                        )}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Map */}
        <div className={styles.mapPanel}>
          <MapPicker
            center={mapCenter}
            marker={
              value?.latitude != null && value?.longitude != null
                ? { lat: value.latitude, lon: value.longitude }
                : null
            }
            onPick={pickFromMap}
            height={220}
            zoom={mapZoom}
            key={`${mapCenter.lat}-${mapCenter.lon}-${mapZoom}`}
          />
        </div>
      </div>
    </div>
  );
}

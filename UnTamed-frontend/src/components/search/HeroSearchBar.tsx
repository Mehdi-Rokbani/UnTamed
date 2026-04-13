import { useEffect, useRef, useState } from "react";
import { suggestPublicAddresses, type AddressSuggestion } from "../../api/activity.api";
import styles from "../../style/HeroSearchBar.module.css";

type Props = {
  queryInput: string;
  locationInput: string;
  selectedAddressId: string | null;
  dateFrom: string;
  dateTo: string;
  onQueryInputChange: (value: string) => void;
  onLocationInputChange: (value: string) => void;
  onLocationSelect: (address: AddressSuggestion) => void;
  onDateFromChange: (value: string) => void;
  onDateToChange: (value: string) => void;
  /** Compact mode: used when embedded in the sticky header */
  compact?: boolean;
};

export function HeroSearchBar({
  queryInput,
  locationInput,
  selectedAddressId,
  dateFrom,
  dateTo,
  onQueryInputChange,
  onLocationInputChange,
  onLocationSelect,
  onDateFromChange,
  onDateToChange,
  compact = false,
}: Props) {
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [open, setOpen]               = useState(false);
  const [loading, setLoading]         = useState(false);
  const [focused, setFocused]         = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);

  /* Close dropdown on outside click */
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
        setFocused(null);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  /* Address suggestions */
  useEffect(() => {
    const trimmed = locationInput.trim();
    if (!trimmed) { setSuggestions([]); setOpen(false); return; }

    const handle = window.setTimeout(async () => {
      try {
        setLoading(true);
        const data = await suggestPublicAddresses(trimmed);
        setSuggestions(data);
        setOpen(true);
      } catch {
        setSuggestions([]);
      } finally {
        setLoading(false);
      }
    }, 280);

    return () => window.clearTimeout(handle);
  }, [locationInput]);

  return (
    <div
      ref={rootRef}
      className={`${styles.shell} ${compact ? styles.shellCompact : ""}`}
    >
      <div className={`${styles.pill} ${compact ? styles.pillCompact : ""}`}>

        {/* ── WHAT ── */}
        <div
          className={`${styles.segment} ${focused === "what" ? styles.segmentFocused : ""}`}
          onClick={() => (document.getElementById("hs-what") as HTMLInputElement)?.focus()}
        >
          <span className={styles.segmentLabel}>What</span>
          <div className={styles.inputRow}>
            <svg className={styles.segmentIcon} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
            </svg>
            <input
              id="hs-what"
              className={styles.segmentInput}
              value={queryInput}
              placeholder={compact ? "Activity…" : "Hiking, diving, camping…"}
              onFocus={() => setFocused("what")}
              onBlur={() => setFocused(null)}
              onChange={(e) => onQueryInputChange(e.target.value)}
            />
            {queryInput && (
              <button
                type="button"
                className={styles.clearBtn}
                onClick={() => onQueryInputChange("")}
                aria-label="Clear activity query"
              >
                ×
              </button>
            )}
          </div>
        </div>

        <span className={styles.divider} aria-hidden />

        {/* ── WHERE ── */}
        <div
          className={`${styles.segment} ${styles.segmentWhere} ${focused === "where" ? styles.segmentFocused : ""}`}
          onClick={() => (document.getElementById("hs-where") as HTMLInputElement)?.focus()}
        >
          <span className={styles.segmentLabel}>Where</span>
          <div className={styles.inputRow}>
            <svg className={styles.segmentIcon} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0Z" />
              <circle cx="12" cy="10" r="3" />
            </svg>
            <input
              id="hs-where"
              className={styles.segmentInput}
              value={locationInput}
              placeholder="Any location"
              onFocus={() => { setFocused("where"); if (suggestions.length > 0) setOpen(true); }}
              onBlur={() => setFocused(null)}
              onChange={(e) => onLocationInputChange(e.target.value)}
            />
            {loading && <span className={styles.loadingDots}>…</span>}
            {(locationInput || selectedAddressId) && !loading && (
              <button
                type="button"
                className={styles.clearBtn}
                onClick={() => { onLocationInputChange(""); setSuggestions([]); setOpen(false); }}
                aria-label="Clear location"
              >
                ×
              </button>
            )}
          </div>

          {/* Dropdown */}
          {open && suggestions.length > 0 && (
            <div className={styles.dropdown}>
              {suggestions.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={styles.option}
                  onMouseDown={(e) => e.preventDefault()} // keep focus on input
                  onClick={() => { onLocationSelect(item); setOpen(false); }}
                >
                  <svg className={styles.optionIcon} width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0Z" />
                    <circle cx="12" cy="10" r="3" />
                  </svg>
                  <span>{item.displayName}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* ── DATE FIELDS (hidden in compact mode) ── */}
        {!compact && (
          <>
            <span className={styles.divider} aria-hidden />

            <div
              className={`${styles.segment} ${styles.segmentDate} ${focused === "from" ? styles.segmentFocused : ""}`}
            >
              <span className={styles.segmentLabel}>From</span>
              <input
                className={`${styles.segmentInput} ${styles.dateInput}`}
                type="date"
                value={dateFrom}
                min={new Date().toISOString().split("T")[0]}
                onFocus={() => setFocused("from")}
                onBlur={() => setFocused(null)}
                onChange={(e) => onDateFromChange(e.target.value)}
              />
            </div>

            <span className={styles.divider} aria-hidden />

            <div
              className={`${styles.segment} ${styles.segmentDate} ${focused === "to" ? styles.segmentFocused : ""}`}
            >
              <span className={styles.segmentLabel}>To</span>
              <input
                className={`${styles.segmentInput} ${styles.dateInput}`}
                type="date"
                value={dateTo}
                min={dateFrom || new Date().toISOString().split("T")[0]}
                onFocus={() => setFocused("to")}
                onBlur={() => setFocused(null)}
                onChange={(e) => onDateToChange(e.target.value)}
              />
            </div>
          </>
        )}

        {/* ── SEARCH BUTTON ── */}
        <div className={styles.searchBtnWrap}>
          {/* No onClick here — parent handles search trigger via form / button in HomePage */}
          <button type="submit" className={`${styles.searchBtn} ${compact ? styles.searchBtnCompact : ""}`}>
            <svg width={compact ? 14 : 16} height={compact ? 14 : 16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.35-4.35" />
            </svg>
            {!compact && <span>Search</span>}
          </button>
        </div>

      </div>
    </div>
  );
}
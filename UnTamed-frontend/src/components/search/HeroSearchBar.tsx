import { useEffect, useRef, useState } from "react";
import { suggestPublicAddresses, type AddressSuggestion } from "../../api/activity.api";
import styles from "../../style/HeroSearchBar.module.css";

type Props = {
  addressInput: string;
  selectedAddressId: string | null;
  dateFrom: string;
  dateTo: string;
  onAddressInputChange: (value: string) => void;
  onAddressSelect: (address: AddressSuggestion) => void;
  onDateFromChange: (value: string) => void;
  onDateToChange: (value: string) => void;
};

export function HeroSearchBar({
  addressInput,
  selectedAddressId,
  dateFrom,
  dateTo,
  onAddressInputChange,
  onAddressSelect,
  onDateFromChange,
  onDateToChange,
}: Props) {
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  /* Close dropdown on outside click */
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  /* Debounced address suggestions */
  useEffect(() => {
    const trimmed = addressInput.trim();
    if (!trimmed) {
      setSuggestions([]);
      setOpen(false);
      return;
    }
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
  }, [addressInput]);

  return (
    <div className={styles.shell}>
      {/* ── Single unified pill ── */}
      <div className={styles.pill} ref={rootRef}>

        {/* Segment 1 — Where */}
        <div className={styles.segment}>
          <span className={styles.segmentLabel}>Where</span>
          <div className={styles.addressWrap}>
            <svg className={styles.locationIcon} width="16" height="16" viewBox="0 0 24 24"
              fill="none" stroke="currentColor" strokeWidth="2.2">
              <path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0Z" />
              <circle cx="12" cy="10" r="3" />
            </svg>

            <input
              className={styles.segmentInput}
              value={addressInput}
              placeholder="Search places or activities"
              onFocus={() => { if (suggestions.length > 0) setOpen(true); }}
              onChange={(e) => onAddressInputChange(e.target.value)}
            />

            {loading && <span className={styles.loadingDots}>…</span>}

            {(addressInput || selectedAddressId) && !loading && (
              <button
                type="button"
                className={styles.clearBtn}
                onClick={() => {
                  onAddressInputChange("");
                  setSuggestions([]);
                  setOpen(false);
                }}
                aria-label="Clear address"
              >
                ×
              </button>
            )}
          </div>

          {/* Address dropdown */}
          {open && suggestions.length > 0 && (
            <div className={styles.dropdown}>
              {suggestions.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={styles.option}
                  onClick={() => {
                    onAddressSelect(item);
                    setOpen(false);
                  }}
                >
                  <svg className={styles.optionIcon} width="14" height="14" viewBox="0 0 24 24"
                    fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0Z" />
                    <circle cx="12" cy="10" r="3" />
                  </svg>
                  <span className={styles.optionTitle}>{item.displayName}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Divider */}
        <div className={styles.divider} aria-hidden />

        {/* Segment 2 — Check-in date */}
        <div className={styles.segment}>
          <span className={styles.segmentLabel}>From</span>
          <input
            className={styles.dateInput}
            type="date"
            value={dateFrom}
            min={new Date().toISOString().split("T")[0]}
            onChange={(e) => onDateFromChange(e.target.value)}
          />
        </div>

        {/* Divider */}
        <div className={styles.divider} aria-hidden />

        {/* Segment 3 — Check-out date */}
        <div className={styles.segment}>
          <span className={styles.segmentLabel}>To</span>
          <input
            className={styles.dateInput}
            type="date"
            value={dateTo}
            min={dateFrom || new Date().toISOString().split("T")[0]}
            onChange={(e) => onDateToChange(e.target.value)}
          />
        </div>

        {/* CTA button */}
        <button type="button" className={styles.searchBtn}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2.5">
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.35-4.35" />
          </svg>
          Search
        </button>
      </div>
    </div>
  );
}
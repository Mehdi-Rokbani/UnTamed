import { useEffect, useRef, useState } from "react";
import { suggestPublicAddresses, type AddressSuggestion } from "../../api/activity.api";
import styles from "../../style/AddressAutocompleteInput.module.css";

type Props = {
  value: string;
  selectedAddressId: string | null;
  onInputChange: (value: string) => void;
  onSelect: (address: AddressSuggestion) => void;
  placeholder?: string;
};

export function AddressAutocompleteInput({
  value,
  selectedAddressId,
  onInputChange,
  onSelect,
  placeholder = "Search by address",
}: Props) {
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const onClickOutside = (event: MouseEvent) => {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  useEffect(() => {
    const trimmed = value.trim();

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
      } catch (error) {
        console.error("Failed to load address suggestions", error);
        setSuggestions([]);
      } finally {
        setLoading(false);
      }
    }, 280);

    return () => window.clearTimeout(handle);
  }, [value]);

  return (
    <div className={styles.root} ref={rootRef}>
      <div className={`${styles.inputWrap} ${open ? styles.inputWrapOpen : ""}`}>
        <svg
          className={styles.icon}
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0Z" />
          <circle cx="12" cy="10" r="3" />
        </svg>

        <input
          className={styles.input}
          value={value}
          placeholder={placeholder}
          onFocus={() => {
            if (suggestions.length > 0) setOpen(true);
          }}
          onChange={(e) => {
            onInputChange(e.target.value);
          }}
        />

        {(value || selectedAddressId) && (
          <button
            type="button"
            className={styles.clearBtn}
            onClick={() => {
              onInputChange("");
              setSuggestions([]);
              setOpen(false);
            }}
            aria-label="Clear address"
          >
            ×
          </button>
        )}

        {loading && <span className={styles.loading}>…</span>}
      </div>

      {open && suggestions.length > 0 && (
        <div className={styles.dropdown}>
          {suggestions.map((item) => (
            <button
              key={item.id}
              type="button"
              className={styles.option}
              onClick={() => {
                onSelect(item);
                setOpen(false);
              }}
            >
              <span className={styles.optionTitle}>{item.displayName}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
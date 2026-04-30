/**
 * SmartDiscoveryBar.tsx
 *
 * Replaces both the old "Popular" chips in the hero AND the heavy
 * ExperienceFiltersBar below it with a single, context-aware section.
 *
 * Sections:
 *  1. Smart Category Chips  — scrollable pill chips with icons + active state
 *  2. Progressive Filter Bar — essential filters visible; advanced in a modal
 *  3. Context Labels         — "Trending now", "Near you", etc.
 *
 * Props are designed to be a drop-in replacement for the existing
 * HomePage state + ExperienceFiltersBar props.
 */

import { useEffect, useRef, useState } from "react";
import type { Difficulty } from "../../types/activity";
import styles from "../../style/smart-discovery.module.css";

/* ─────────────────────────────────────────────
   Types
───────────────────────────────────────────── */
interface CategoryOption {
  id: string;
  label: string;
}

export interface SmartDiscoveryBarProps {
  /* Filter state (lifted from HomePage) */
  difficulty: Difficulty | "All";
  categoryIds: string[];
  sort: "popular" | "soonest" | "priceAsc" | "priceDesc";
  minPrice: string;
  maxPrice: string;
  dateFrom: string;
  dateTo: string;
  categories: CategoryOption[];
  resultCount?: number;          // live count shown in pill
  hasActiveFilters?: boolean;

  /* Context mode */
  searchQuery?: string;          // if set → "search mode", else "discovery mode"
  isLoggedIn?: boolean;

  /* Callbacks */
  onDifficultyChange: (d: Difficulty | "All") => void;
  onToggleCategory: (id: string) => void;
  onSortChange: (s: "popular" | "soonest" | "priceAsc" | "priceDesc") => void;
  onMinPriceChange: (v: string) => void;
  onMaxPriceChange: (v: string) => void;
  onDateFromChange: (v: string) => void;
  onDateToChange: (v: string) => void;
  onClearAll: () => void;
}

/* ─────────────────────────────────────────────
   Static data
───────────────────────────────────────────── */
const CATEGORY_ICONS: Record<string, string> = {
  Hiking: "🥾",
  Camping: "⛺",
  Surfing: "🏄",
  Climbing: "🧗",
  "Mountain Biking": "🚵",
  Diving: "🤿",
  Kayaking: "🛶",
  Trekking: "🏔️",
  Cycling: "🚴",
  Swimming: "🏊",
  Skiing: "⛷️",
  Running: "🏃",
};

const DISCOVERY_CONTEXTS = [
  { id: "trending",  label: "Trending now",           icon: "🔥" },
  { id: "weekend",   label: "Perfect this weekend",   icon: "📅" },
  { id: "nearby",    label: "Near you",               icon: "📍" },
  { id: "beginner",  label: "Great for beginners",    icon: "✨" },
  { id: "top_rated", label: "Top rated",              icon: "⭐" },
];

const SORT_OPTIONS = [
  { value: "popular",   label: "Most popular" },
  { value: "soonest",   label: "Soonest" },
  { value: "priceAsc",  label: "Price ↑" },
  { value: "priceDesc", label: "Price ↓" },
] as const;

/* ─────────────────────────────────────────────
   Component
───────────────────────────────────────────── */
export function SmartDiscoveryBar({
  difficulty,
  categoryIds,
  sort,
  minPrice,
  maxPrice,
  dateFrom,
  dateTo,
  categories,
  resultCount,
  hasActiveFilters = false,
  searchQuery = "",
  isLoggedIn = false,
  onDifficultyChange,
  onToggleCategory,
  onSortChange,
  onMinPriceChange,
  onMaxPriceChange,
  onDateFromChange,
  onDateToChange,
  onClearAll,
}: SmartDiscoveryBarProps) {
  const [sticky, setSticky] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [activeContext, setActiveContext] = useState<string | null>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const chipScrollRef = useRef<HTMLDivElement>(null);

  /* ── Sticky on scroll ── */
  useEffect(() => {
    const onScroll = () => {
      if (!barRef.current) return;
      const { top } = barRef.current.getBoundingClientRect();
      // become sticky when bar hits top of viewport
      setSticky(top <= 64); // 64 = approx header height
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  /* ── Context label ── */
  const contextLabel = searchQuery
    ? `Results for "${searchQuery}"`
    : isLoggedIn
    ? "Based on your interests"
    : "Trending now";

  const activeFilterCount = [
    categoryIds.length > 0,
    difficulty !== "All",
    !!minPrice || !!maxPrice,
    !!dateFrom || !!dateTo,
  ].filter(Boolean).length;

  return (
    <>
      <div
        ref={barRef}
        className={`${styles.discoveryBar} ${sticky ? styles.discoveryBarSticky : ""}`}
        role="region"
        aria-label="Filter and discover experiences"
      >
        <div className={styles.discoveryInner}>

          {/* ── Row 1: Context strip + Sort ── */}
          <div className={styles.contextRow}>
            <div className={styles.contextScroll}>
              {/* Context label pill */}
              <span className={styles.contextPill}>
                {searchQuery ? "🔍" : isLoggedIn ? "✨" : "🔥"}
                &nbsp;{contextLabel}
              </span>

              {/* Discovery context chips (only in discovery mode) */}
              {!searchQuery &&
                DISCOVERY_CONTEXTS.map((ctx) => (
                  <button
                    key={ctx.id}
                    type="button"
                    className={`${styles.contextChip} ${
                      activeContext === ctx.id ? styles.contextChipActive : ""
                    }`}
                    onClick={() =>
                      setActiveContext((prev) => (prev === ctx.id ? null : ctx.id))
                    }
                    aria-pressed={activeContext === ctx.id}
                  >
                    <span className={styles.chipIcon}>{ctx.icon}</span>
                    {ctx.label}
                  </button>
                ))}
            </div>

            {/* Sort — lightweight dropdown */}
            <div className={styles.sortWrap}>
              <select
                className={styles.sortSelect}
                value={sort}
                onChange={(e) => onSortChange(e.target.value as typeof sort)}
                aria-label="Sort experiences"
              >
                {SORT_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* ── Row 2: Category chips + Progressive filter bar ── */}
          <div className={styles.filterRow}>
            {/* Category chips — horizontally scrollable */}
            <div className={styles.chipScroll} ref={chipScrollRef} role="group" aria-label="Category filters">
              {categories.map((cat) => {
                const active = categoryIds.includes(cat.id);
                return (
                  <button
                    key={cat.id}
                    type="button"
                    className={`${styles.categoryChip} ${active ? styles.categoryChipActive : ""}`}
                    onClick={() => onToggleCategory(cat.id)}
                    aria-pressed={active}
                  >
                    {CATEGORY_ICONS[cat.label] && (
                      <span className={styles.chipIcon} aria-hidden="true">
                        {CATEGORY_ICONS[cat.label]}
                      </span>
                    )}
                    {cat.label}
                  </button>
                );
              })}
            </div>

            {/* Essential date filter — always visible */}
            <div className={styles.essentialFilters}>
              <label className={styles.essentialLabel} htmlFor="filter-date-from">
                <span className={styles.essentialIcon}>📅</span>
                <span className={styles.essentialText}>Date</span>
              </label>
              <input
                id="filter-date-from"
                type="date"
                className={styles.dateInput}
                value={dateFrom}
                onChange={(e) => onDateFromChange(e.target.value)}
                aria-label="From date"
                title="From"
              />

              {/* Advanced filters button */}
              <button
                type="button"
                className={`${styles.moreFiltersBtn} ${activeFilterCount > 0 ? styles.moreFiltersBtnActive : ""}`}
                onClick={() => setModalOpen(true)}
                aria-expanded={modalOpen}
                aria-haspopup="dialog"
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                  <path d="M1 3h12M3 7h8M5 11h4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
                </svg>
                Filters
                {activeFilterCount > 0 && (
                  <span className={styles.filterBadge}>{activeFilterCount}</span>
                )}
              </button>
            </div>
          </div>

          {/* ── Row 3: Result count + Clear ── */}
          {(hasActiveFilters || activeContext) && (
            <div className={styles.resultRow}>
              <div className={styles.resultCount}>
                {resultCount !== undefined ? (
                  <>
                    <span className={styles.resultDot} />
                    <span>
                      <strong>{resultCount}</strong>{" "}
                      {resultCount === 1 ? "experience" : "experiences"} found
                    </span>
                  </>
                ) : null}
              </div>

              {hasActiveFilters && (
                <button
                  type="button"
                  className={styles.clearBtn}
                  onClick={() => {
                    onClearAll();
                    setActiveContext(null);
                  }}
                >
                  ✕ Clear filters
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ════════════════════════════════════
          ADVANCED FILTERS MODAL
      ════════════════════════════════════ */}
      {modalOpen && (
        <div
          className={styles.modalOverlay}
          role="dialog"
          aria-modal="true"
          aria-label="Advanced filters"
          onClick={(e) => {
            if (e.target === e.currentTarget) setModalOpen(false);
          }}
        >
          <div className={styles.modal}>
            <div className={styles.modalHeader}>
              <h2 className={styles.modalTitle}>Filters</h2>
              <button
                type="button"
                className={styles.modalClose}
                onClick={() => setModalOpen(false)}
                aria-label="Close filters"
              >
                ✕
              </button>
            </div>

            <div className={styles.modalBody}>
              {/* Difficulty */}
              <div className={styles.filterGroup}>
                <p className={styles.filterGroupLabel}>Difficulty</p>
                <div className={styles.difficultyChips} role="group">
                  {(["All", "EASY", "MEDIUM", "HARD"] as const).map((d) => (
                    <button
                      key={d}
                      type="button"
                      className={`${styles.diffChip} ${
                        difficulty === d ? styles.diffChipActive : ""
                      } ${d !== "All" ? styles[`diff${d.charAt(0) + d.slice(1).toLowerCase()}`] : ""}`}
                      onClick={() => onDifficultyChange(d as Difficulty | "All")}
                      aria-pressed={difficulty === d}
                    >
                      {d === "All" ? "All levels" : d.charAt(0) + d.slice(1).toLowerCase()}
                    </button>
                  ))}
                </div>
              </div>

              {/* Price range */}
              <div className={styles.filterGroup}>
                <p className={styles.filterGroupLabel}>Price range</p>
                <div className={styles.priceRow}>
                  <div className={styles.priceField}>
                    <span className={styles.pricePrefix}>$</span>
                    <input
                      type="number"
                      className={styles.priceInput}
                      placeholder="Min"
                      value={minPrice}
                      onChange={(e) => onMinPriceChange(e.target.value)}
                      min={0}
                      aria-label="Minimum price"
                    />
                  </div>
                  <span className={styles.priceDash}>—</span>
                  <div className={styles.priceField}>
                    <span className={styles.pricePrefix}>$</span>
                    <input
                      type="number"
                      className={styles.priceInput}
                      placeholder="Max"
                      value={maxPrice}
                      onChange={(e) => onMaxPriceChange(e.target.value)}
                      min={0}
                      aria-label="Maximum price"
                    />
                  </div>
                </div>
              </div>

              {/* Date range */}
              <div className={styles.filterGroup}>
                <p className={styles.filterGroupLabel}>Date range</p>
                <div className={styles.dateRow}>
                  <div className={styles.dateField}>
                    <label className={styles.dateFieldLabel} htmlFor="modal-date-from">From</label>
                    <input
                      id="modal-date-from"
                      type="date"
                      className={styles.modalDateInput}
                      value={dateFrom}
                      onChange={(e) => onDateFromChange(e.target.value)}
                    />
                  </div>
                  <div className={styles.dateField}>
                    <label className={styles.dateFieldLabel} htmlFor="modal-date-to">To</label>
                    <input
                      id="modal-date-to"
                      type="date"
                      className={styles.modalDateInput}
                      value={dateTo}
                      onChange={(e) => onDateToChange(e.target.value)}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Modal footer */}
            <div className={styles.modalFooter}>
              <button
                type="button"
                className={styles.modalClearBtn}
                onClick={() => {
                  onClearAll();
                  setModalOpen(false);
                }}
              >
                Clear all
              </button>
              <button
                type="button"
                className={styles.modalApplyBtn}
                onClick={() => setModalOpen(false)}
              >
                {resultCount !== undefined
                  ? `Show ${resultCount} results`
                  : "Apply filters"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
import { useMemo, useRef } from "react";
import type { Difficulty } from "../../types/activity";
import styles from "../../style/ExperienceFiltersBar.module.css";

export type CategoryOption = {
  id: string;
  label: string;
};

type Props = {
  difficulty: Difficulty | "All";
  categoryIds: string[];
  sort: "popular" | "soonest" | "priceAsc" | "priceDesc";
  minPrice: string;
  maxPrice: string;
  categories: CategoryOption[];
  onDifficultyChange: (value: Difficulty | "All") => void;
  onToggleCategory: (id: string) => void;
  onSortChange: (value: "popular" | "soonest" | "priceAsc" | "priceDesc") => void;
  onMinPriceChange: (value: string) => void;
  onMaxPriceChange: (value: string) => void;
  onClearAll?: () => void;
};

export function ExperienceFiltersBar({
  difficulty,
  categoryIds,
  sort,
  minPrice,
  maxPrice,
  categories,
  onDifficultyChange,
  onToggleCategory,
  onSortChange,
  onMinPriceChange,
  onMaxPriceChange,
  onClearAll,
}: Props) {
  const chipsRef = useRef<HTMLDivElement>(null);

  const activeCount = useMemo(() => {
    let n = 0;
    if (difficulty !== "All") n++;
    if (sort !== "popular") n++;
    if (minPrice) n++;
    if (maxPrice) n++;
    n += categoryIds.length;
    return n;
  }, [difficulty, sort, minPrice, maxPrice, categoryIds]);

  return (
    <div className={styles.stickyBar}>
      <div className={styles.inner}>

        {/* ── Categories strip ── */}
        {categories.length > 0 && (
          <div className={styles.section}>
            <span className={styles.sectionLabel}>Category</span>
            <div className={styles.chipsScroll} ref={chipsRef}>
              {categories.map((item) => {
                const active = categoryIds.includes(item.id);
                return (
                  <button
                    key={item.id}
                    type="button"
                    className={`${styles.chip} ${active ? styles.chipActive : ""}`}
                    onClick={() => onToggleCategory(item.id)}
                  >
                    {active && (
                      <svg className={styles.chipCheck} width="12" height="12" viewBox="0 0 24 24"
                        fill="none" stroke="currentColor" strokeWidth="3">
                        <path d="M20 6 9 17l-5-5" />
                      </svg>
                    )}
                    {item.label}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div className={styles.divider} />

        {/* ── Difficulty ── */}
        <div className={styles.section}>
          <span className={styles.sectionLabel}>Difficulty</span>
          <div className={styles.selectWrap}>
            <select
              className={`${styles.select} ${difficulty !== "All" ? styles.selectActive : ""}`}
              value={difficulty}
              onChange={(e) => onDifficultyChange(e.target.value as Difficulty | "All")}
            >
              <option value="All">All levels</option>
              <option value="EASY">Easy</option>
              <option value="MEDIUM">Medium</option>
              <option value="HARD">Hard</option>
            </select>
            {difficulty !== "All" && <span className={styles.selectDot} />}
          </div>
        </div>

        <div className={styles.divider} />

        {/* ── Price range ── */}
        <div className={styles.section}>
          <span className={styles.sectionLabel}>Price range</span>
          <div className={`${styles.priceRow} ${(minPrice || maxPrice) ? styles.priceRowActive : ""}`}>
            <input
              className={styles.priceInput}
              type="number"
              min="0"
              placeholder="Min $"
              value={minPrice}
              onChange={(e) => onMinPriceChange(e.target.value)}
            />
            <span className={styles.priceSep}>–</span>
            <input
              className={styles.priceInput}
              type="number"
              min="0"
              placeholder="Max $"
              value={maxPrice}
              onChange={(e) => onMaxPriceChange(e.target.value)}
            />
          </div>
        </div>

        <div className={styles.divider} />

        {/* ── Sort ── */}
        <div className={styles.section}>
          <span className={styles.sectionLabel}>Sort by</span>
          <div className={styles.selectWrap}>
            <select
              className={`${styles.select} ${sort !== "popular" ? styles.selectActive : ""}`}
              value={sort}
              onChange={(e) =>
                onSortChange(e.target.value as "popular" | "soonest" | "priceAsc" | "priceDesc")
              }
            >
              <option value="popular">Most popular</option>
              <option value="soonest">Soonest</option>
              <option value="priceAsc">Price: low → high</option>
              <option value="priceDesc">Price: high → low</option>
            </select>
            {sort !== "popular" && <span className={styles.selectDot} />}
          </div>
        </div>

        {/* ── Clear all ── */}
        {activeCount > 0 && onClearAll && (
          <>
            <div className={styles.divider} />
            <button type="button" className={styles.clearBtn} onClick={onClearAll}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2.5">
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
              Clear
              <span className={styles.clearBadge}>{activeCount}</span>
            </button>
          </>
        )}

      </div>
    </div>
  );
}
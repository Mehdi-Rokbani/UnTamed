import { useEffect, useMemo, useState } from "react";
import type { Difficulty, PublicTemplateCard } from "../types/activity";
import type { Category } from "../types/category";
import { ActivityCard } from "../components/ActivityCard";
import { Header } from "../components/Header";
import RecommendedActivities from "../components/RecommendedActivities";
import { useAuth } from "../auth/auth.store";
import styles from "../style/home.module.css";
import { searchPublicTemplates, type AddressSuggestion } from "../api/activity.api";
import { listCategories } from "../api/category.api";
import { HeroSearchBar } from "../components/search/HeroSearchBar";
import { ExperienceFiltersBar } from "../components/search/ExperienceFiltersBar";
import { ActiveFilterChips } from "../components/search/ActiveFilterChips";

type LoadState = "idle" | "loading" | "error" | "done";

export default function HomePage() {
  const { user } = useAuth();

  const [state, setState] = useState<LoadState>("idle");
  const [templates, setTemplates] = useState<PublicTemplateCard[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);

  const [addressInput, setAddressInput] = useState("");
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);

  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const [difficulty, setDifficulty] = useState<Difficulty | "All">("All");
  const [categoryIds, setCategoryIds] = useState<string[]>([]);
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [sort, setSort] = useState<"popular" | "soonest" | "priceAsc" | "priceDesc">("popular");

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const data = await listCategories();
        if (cancelled) return;
        setCategories(data ?? []);
      } catch (error) {
        console.error("Failed to load categories", error);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const categoryOptions = useMemo(
    () => categories.map((item) => ({ id: item.id, label: item.name })),
    [categories]
  );

  const hasActiveFilters = useMemo(() => {
    return Boolean(
      addressInput.trim() ||
        selectedAddressId ||
        dateFrom ||
        dateTo ||
        categoryIds.length > 0 ||
        minPrice ||
        maxPrice ||
        difficulty !== "All"
    );
  }, [addressInput, selectedAddressId, dateFrom, dateTo, categoryIds, minPrice, maxPrice, difficulty]);

  useEffect(() => {
    let cancelled = false;

    const handle = window.setTimeout(async () => {
      setState("loading");

      try {
        const data = await searchPublicTemplates({
          addressId: selectedAddressId || undefined,
          q: selectedAddressId ? undefined : addressInput.trim() || undefined,
          categoryIds: categoryIds.length ? categoryIds : undefined,
          minPrice: minPrice ? Number(minPrice) : undefined,
          maxPrice: maxPrice ? Number(maxPrice) : undefined,
          difficulty: difficulty === "All" ? undefined : difficulty,
          dateFrom: dateFrom ? new Date(`${dateFrom}T00:00:00`).toISOString() : undefined,
          dateTo: dateTo ? new Date(`${dateTo}T23:59:59`).toISOString() : undefined,
          sort,
        });

        if (cancelled) return;

        setTemplates(data ?? []);
        setState("done");
      } catch (error) {
        console.error("Failed to search templates", error);
        if (!cancelled) setState("error");
      }
    }, 260);

    return () => {
      cancelled = true;
      window.clearTimeout(handle);
    };
  }, [addressInput, selectedAddressId, categoryIds, minPrice, maxPrice, difficulty, dateFrom, dateTo, sort]);

  const handleAddressSelect = (address: AddressSuggestion) => {
    setAddressInput(address.displayName);
    setSelectedAddressId(address.id);
  };

  const handleAddressInputChange = (value: string) => {
    setAddressInput(value);
    setSelectedAddressId(null);
  };

  const handleToggleCategory = (id: string) => {
    setCategoryIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const handleClearFilters = () => {
    setAddressInput("");
    setSelectedAddressId(null);
    setDateFrom("");
    setDateTo("");
    setDifficulty("All");
    setCategoryIds([]);
    setMinPrice("");
    setMaxPrice("");
    setSort("popular");
  };

  return (
    <>
      <Header />

      <main className={styles.home}>
        <section className={styles.homeHero}>
          <div className={styles.heroBackground} />

          <div className={styles.heroContent}>
            <h1 className={styles.homeTitle}>
              Find your next <span className={styles.accent}>UnTamed</span> adventure
            </h1>

            <p className={styles.homeSubtitle}>
              Browse curated outdoor experiences posted by expert guides.
              <br />
              Book, explore, and reconnect with nature.
            </p>

            <div className={styles.heroSearchStack}>
              <HeroSearchBar
                addressInput={addressInput}
                selectedAddressId={selectedAddressId}
                dateFrom={dateFrom}
                dateTo={dateTo}
                onAddressInputChange={handleAddressInputChange}
                onAddressSelect={handleAddressSelect}
                onDateFromChange={setDateFrom}
                onDateToChange={setDateTo}
              />

              <ActiveFilterChips
                addressInput={addressInput}
                selectedAddressId={selectedAddressId}
                dateFrom={dateFrom}
                dateTo={dateTo}
                difficulty={difficulty}
                categoryIds={categoryIds}
                minPrice={minPrice}
                maxPrice={maxPrice}
                categories={categoryOptions}
                onClearAddress={() => {
                  setAddressInput("");
                  setSelectedAddressId(null);
                }}
                onClearDateFrom={() => setDateFrom("")}
                onClearDateTo={() => setDateTo("")}
                onClearDifficulty={() => setDifficulty("All")}
                onRemoveCategory={(id) => setCategoryIds((prev) => prev.filter((x) => x !== id))}
                onClearMinPrice={() => setMinPrice("")}
                onClearMaxPrice={() => setMaxPrice("")}
                onClearAll={handleClearFilters}
              />

              {state === "done" && (
                <div className={styles.statsBar}>
                  <div className={styles.stat}>
                    <span className={styles.statNumber}>{templates.length}</span>
                    <span className={styles.statLabel}>Showing</span>
                  </div>

                  {hasActiveFilters && (
                    <>
                      <div className={styles.statDivider} />
                      <div className={styles.stat}>
                        <span className={styles.statIcon}>⚡</span>
                        <span className={styles.statLabel}>Auto-updated</span>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </section>

        <ExperienceFiltersBar
          difficulty={difficulty}
          categoryIds={categoryIds}
          sort={sort}
          minPrice={minPrice}
          maxPrice={maxPrice}
          categories={categoryOptions}
          onDifficultyChange={setDifficulty}
          onToggleCategory={handleToggleCategory}
          onSortChange={setSort}
          onMinPriceChange={setMinPrice}
          onMaxPriceChange={setMaxPrice}
          onClearAll={handleClearFilters}
        />

        {user && (
          <section className={styles.activitiesSection}>
            <div className={styles.container}>
              <RecommendedActivities title="Recommended for you" limit={6} />
            </div>
          </section>
        )}

        <section className={styles.activitiesSection}>
          <div className={styles.container}>
            {state === "loading" && (
              <div className={styles.stateContainer}>
                <div className={styles.loadingSpinner} />
                <p className={styles.stateText}>Loading adventures...</p>
              </div>
            )}

            {state === "error" && (
              <div className={`${styles.stateContainer} ${styles.stateError}`}>
                <p className={styles.stateText}>Failed to load experiences</p>
                <p className={styles.stateSubtext}>Please check your connection and try again</p>
              </div>
            )}

            {state === "done" && templates.length === 0 && (
              <div className={styles.stateContainer}>
                <p className={styles.stateText}>No experiences match your filters</p>
                <p className={styles.stateSubtext}>
                  Try adjusting your address, date, category, or price
                </p>
                <button className={styles.btnSecondary} onClick={handleClearFilters} type="button">
                  Clear all filters
                </button>
              </div>
            )}

            {templates.length > 0 && (
              <>
                <div className={styles.sectionHeader}>
                  <h2 className={styles.sectionTitle}>Available Experiences</h2>
                  <p className={styles.sectionSubtitle}>
                    {templates.length} {templates.length === 1 ? "experience" : "experiences"} waiting
                    for you
                  </p>
                </div>

                <div className={styles.activityGrid}>
                  {templates.map((t, index) => (
                    <ActivityCard key={t.id} activity={t} index={index} />
                  ))}
                </div>
              </>
            )}
          </div>
        </section>
      </main>
    </>
  );
}
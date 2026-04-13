import { useEffect, useMemo, useRef, useState } from "react";
import type { Difficulty, PublicTemplateCard } from "../types/activity";
import type { Category } from "../types/category";
import { ActivityCard } from "../components/ActivityCard";
import { Header } from "../components/Header";
import RecommendedActivities from "../components/RecommendedActivities";
import { useAuth } from "../auth/auth.store";
import styles from "../style/home.module.css";
import { type AddressSuggestion } from "../api/activity.api";
import { listCategories } from "../api/category.api";
import { HeroSearchBar } from "../components/search/HeroSearchBar";
import { ExperienceFiltersBar } from "../components/search/ExperienceFiltersBar";
import { ActiveFilterChips } from "../components/search/ActiveFilterChips";
import { semanticSearch } from "../api/search.api";

type LoadState = "idle" | "loading" | "error" | "done";

export default function HomePage() {
  const { user } = useAuth();

  const [state, setState] = useState<LoadState>("idle");
  const [templates, setTemplates] = useState<PublicTemplateCard[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);

  const [queryInput, setQueryInput] = useState("");
  const [locationInput, setLocationInput] = useState("");
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [difficulty, setDifficulty] = useState<Difficulty | "All">("All");
  const [categoryIds, setCategoryIds] = useState<string[]>([]);
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [sort, setSort] = useState<"popular" | "soonest" | "priceAsc" | "priceDesc">("popular");

  const [scrolled, setScrolled] = useState(false);
  const [showCompactSearch, setShowCompactSearch] = useState(false);
  const resultsRef = useRef<HTMLElement>(null);
  const heroRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const handleScroll = () => {
      const heroBottom = heroRef.current
        ? heroRef.current.getBoundingClientRect().bottom
        : 320;

      setScrolled(window.scrollY > 80);
      setShowCompactSearch(heroBottom < 80);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const data = await listCategories();
        if (!cancelled) {
          setCategories(data ?? []);
        }
      } catch (err) {
        console.error("Failed to load categories", err);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const categoryOptions = useMemo(
    () => categories.map((c) => ({ id: c.id, label: c.name })),
    [categories]
  );

  const hasActiveFilters = useMemo(
    () =>
      Boolean(
        queryInput.trim() ||
          locationInput.trim() ||
          selectedAddressId ||
          dateFrom ||
          dateTo ||
          categoryIds.length > 0 ||
          minPrice ||
          maxPrice ||
          difficulty !== "All"
      ),
    [
      queryInput,
      locationInput,
      selectedAddressId,
      dateFrom,
      dateTo,
      categoryIds,
      minPrice,
      maxPrice,
      difficulty,
    ]
  );

  const hasLocationFilter = Boolean(selectedAddressId);
  const isAiSearch = queryInput.trim().length > 0;

  useEffect(() => {
    let cancelled = false;

    const handle = window.setTimeout(async () => {
      setState("loading");

      try {
        const results = await semanticSearch({
          query: queryInput.trim() || "activities",
          addressId: selectedAddressId || undefined,
          limit: 12,
          difficulty: difficulty === "All" ? undefined : difficulty,
          categoryId: categoryIds.length === 1 ? categoryIds[0] : undefined,
          minPrice: minPrice ? Number(minPrice) : undefined,
          maxPrice: maxPrice ? Number(maxPrice) : undefined,
          dateFrom: dateFrom ? new Date(`${dateFrom}T00:00:00`).toISOString() : undefined,
          dateTo: dateTo ? new Date(`${dateTo}T23:59:59`).toISOString() : undefined,
          sort,
        });

        const data: PublicTemplateCard[] = results.map((r) => ({
          id: r.templateId,
          title: r.title,
          description: r.description,
          coverImageUrl: r.coverImageUrl,
          categoryIds: r.categoryIds,
          difficulty: (r.difficulty as Difficulty) ?? "EASY",
          price: r.price ?? 0,
          ratingAverage: r.ratingAverage ?? 0,
          ratingCount: r.ratingCount ?? 0,
          nextSessionDate: r.nextSessionDate,

          tags: [],

          rating: {
            average: r.ratingAverage ?? 0,
            count: r.ratingCount ?? 0,
          },

          upcomingSessionsCount: r.nextSessionDate ? 1 : 0,

          images: r.coverImageUrl
            ? [
                {
                  url: r.coverImageUrl,
                  thumbnailUrl: r.coverImageUrl,
                },
              ]
            : [],

          totalBookedCount: 0,
        }));

        if (!cancelled) {
          setTemplates(data);
          setState("done");
        }
      } catch (err) {
        console.error("Failed to search templates", err);
        if (!cancelled) {
          setTemplates([]);
          setState("error");
        }
      }
    }, 260);

    return () => {
      cancelled = true;
      window.clearTimeout(handle);
    };
  }, [
    queryInput,
    selectedAddressId,
    categoryIds,
    minPrice,
    maxPrice,
    difficulty,
    dateFrom,
    dateTo,
    sort,
  ]);

  const handleLocationSelect = (address: AddressSuggestion) => {
    setLocationInput(address.displayName);
    setSelectedAddressId(address.id);
  };

  const handleLocationInputChange = (value: string) => {
    setLocationInput(value);
    setSelectedAddressId(null);
  };

  const handleToggleCategory = (id: string) => {
    setCategoryIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleClearFilters = () => {
    setQueryInput("");
    setLocationInput("");
    setSelectedAddressId(null);
    setDateFrom("");
    setDateTo("");
    setDifficulty("All");
    setCategoryIds([]);
    setMinPrice("");
    setMaxPrice("");
    setSort("popular");
  };

  const scrollToResults = () => {
    resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <>
      <div
        className={`${styles.headerWrap} ${
          scrolled ? styles.headerWrapScrolled : styles.headerWrapHero
        }`}
      >
        <Header
          compactSearch={
            showCompactSearch ? (
              <HeroSearchBar
                queryInput={queryInput}
                locationInput={locationInput}
                selectedAddressId={selectedAddressId}
                dateFrom={dateFrom}
                dateTo={dateTo}
                onQueryInputChange={setQueryInput}
                onLocationInputChange={handleLocationInputChange}
                onLocationSelect={handleLocationSelect}
                onDateFromChange={setDateFrom}
                onDateToChange={setDateTo}
                compact
              />
            ) : null
          }
        />
      </div>

      <main className={styles.home}>
        <section ref={heroRef} className={styles.homeHero}>
          <div className={styles.heroBackground} />

          <div className={styles.heroContent}>
            <div className={styles.heroBadge}>
              <span>✦ AI-POWERED ADVENTURE SEARCH</span>
            </div>

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
                queryInput={queryInput}
                locationInput={locationInput}
                selectedAddressId={selectedAddressId}
                dateFrom={dateFrom}
                dateTo={dateTo}
                onQueryInputChange={setQueryInput}
                onLocationInputChange={handleLocationInputChange}
                onLocationSelect={handleLocationSelect}
                onDateFromChange={setDateFrom}
                onDateToChange={setDateTo}
              />

              <ActiveFilterChips
                addressInput={locationInput}
                selectedAddressId={selectedAddressId}
                dateFrom={dateFrom}
                dateTo={dateTo}
                difficulty={difficulty}
                categoryIds={categoryIds}
                minPrice={minPrice}
                maxPrice={maxPrice}
                categories={categoryOptions}
                onClearAddress={() => {
                  setLocationInput("");
                  setSelectedAddressId(null);
                }}
                onClearDateFrom={() => setDateFrom("")}
                onClearDateTo={() => setDateTo("")}
                onClearDifficulty={() => setDifficulty("All")}
                onRemoveCategory={(id) =>
                  setCategoryIds((prev) => prev.filter((x) => x !== id))
                }
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

                  {hasLocationFilter && (
                    <>
                      <div className={styles.statDivider} />
                      <div className={styles.stat}>
                        <span className={styles.statIcon}>📍</span>
                        <span className={styles.statLabel}>Location applied</span>
                      </div>
                    </>
                  )}

                  {templates.length > 0 && (
                    <>
                      <div className={styles.statDivider} />
                      <button
                        type="button"
                        className={styles.seeResultsBtn}
                        onClick={scrollToResults}
                      >
                        See results ↓
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>

            <div className={styles.heroStats}>
              {[
                ["200+", "Experiences"],
                ["50+", "Expert guides"],
                ["4.8★", "Avg rating"],
              ].map(([num, label]) => (
                <div key={label} className={styles.heroStat}>
                  <span className={styles.heroStatNum}>{num}</span>
                  <span className={styles.heroStatLabel}>{label}</span>
                </div>
              ))}
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

        <section ref={resultsRef} className={styles.activitiesSection}>
          <div className={styles.container}>
            {state === "loading" && (
              <div className={styles.stateContainer}>
                <div className={styles.loadingSpinner} />
                <p className={styles.stateText}>Loading adventures…</p>
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
                <p className={styles.stateText}>No experiences match your search</p>
                <p className={styles.stateSubtext}>
                  Try changing the activity, location, date, category, or price
                </p>
                <button className={styles.btnSecondary} onClick={handleClearFilters} type="button">
                  Clear all filters
                </button>
              </div>
            )}

            {templates.length > 0 && (
              <>
                <div className={styles.sectionHeader}>
                  <div>
                    <h2 className={styles.sectionTitle}>
                      {isAiSearch ? "AI-powered results" : "Available Experiences"}
                    </h2>
                    <p className={styles.sectionSubtitle}>
                      {isAiSearch
                        ? "Results based on meaning, with filters like location and price applied"
                        : `${templates.length} ${
                            templates.length === 1 ? "experience" : "experiences"
                          } waiting for you`}
                    </p>
                  </div>

                  <div className={styles.sortInline}>
                    <label className={styles.sortLabel}>Sort:</label>
                    <select
                      className={styles.sortSelect}
                      value={sort}
                      onChange={(e) =>
                        setSort(
                          e.target.value as "popular" | "soonest" | "priceAsc" | "priceDesc"
                        )
                      }
                    >
                      <option value="popular">Most popular</option>
                      <option value="soonest">Soonest</option>
                      <option value="priceAsc">Price: low → high</option>
                      <option value="priceDesc">Price: high → low</option>
                    </select>
                  </div>
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
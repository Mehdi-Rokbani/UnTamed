import { useEffect, useMemo, useRef, useState } from "react";
import type { Difficulty, PublicTemplateCard } from "../types/activity";
import type { Category } from "../types/category";
import { ActivityCard } from "../components/ActivityCard";
import { Header } from "../components/Header";
import RecommendedActivities from "../components/RecommendedActivities";
import { useAuth } from "../auth/auth.store";
import styles from "../style/home.module.css";
import {
  type AddressSuggestion,
  listPublicTemplatesPage,
  searchPublicTemplatesPage,
  suggestPublicAddresses,
} from "../api/activity.api";
import { listCategories } from "../api/category.api";
import { HeroSearchBar } from "../components/search/HeroSearchBar";
import { SmartDiscoveryBar } from "../components/search/Smartdiscoverybar";
import { semanticSearchPage, type SemanticSearchItem } from "../api/search.api";

type LoadState = "idle" | "loading" | "error" | "done";
const PAGE_SIZE = 12;

const QUICK_SUGGESTIONS = [
  "Hiking",
  "Surfing",
  "Diving",
  "Camping",
  "MTB",
];

const HERO_VISUAL_CARDS = [
  {
    title: "Douz Desert Camp",
    meta: "DOUZ - EASY",
    status: "4 spots left",
    className: "sceneDesert",
  },
  {
    title: "Cap Serrat Surf Morning",
    meta: "CAP SERRAT - BEGINNER",
    status: "Open this week",
    className: "sceneOcean",
  },
  {
    title: "Zaghouan Mountain Hike",
    meta: "ZAGHOUAN - MODERATE",
    status: "Local guide",
    className: "sceneForest",
  },
  {
    title: "Chebika Waterfall Trek",
    meta: "CHEBIKA - MODERATE",
    status: "Small group",
    className: "sceneOasis",
  },
];

function semanticItemToTemplateCard(item: SemanticSearchItem): PublicTemplateCard {
  return {
    id: item.templateId,
    title: item.title,
    description: item.description,
    difficulty: ((item.difficulty ?? "EASY").toUpperCase() as Difficulty),
    price: item.price ?? 0,
    tags: [],
    coverImageUrl: item.coverImageUrl ?? null,
    rating: {
      average: item.ratingAverage ?? 0,
      count: item.ratingCount ?? 0,
    },
    nextSession: item.nextSessionDate
      ? {
          sessionId: `next-${item.templateId}`,
          date: item.nextSessionDate,
          capacity: 0,
          bookedCount: 0,
        }
      : null,
    upcomingSessionsCount: item.nextSessionDate ? 1 : 0,
    images: item.coverImageUrl
      ? [
          {
            url: item.coverImageUrl,
            publicId: null,
            alt: item.title,
            cover: true,
            order: 0,
          },
        ]
      : [],
    addressDisplayName: null,
    governorate: null,
    latitude: null,
    longitude: null,
    totalBookedCount: 0,
    guide: null,
  };
}

export default function HomePage() {
  const { user } = useAuth();

  const [state, setState] = useState<LoadState>("idle");
  const [templates, setTemplates] = useState<PublicTemplateCard[]>([]);
  const [page, setPage] = useState(0);
  const [lastPage, setLastPage] = useState(true);
  const [totalElements, setTotalElements] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);

  const [queryInput, setQueryInput] = useState("");
  const [locationInput, setLocationInput] = useState("");
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
  const [heroLocationSuggestions, setHeroLocationSuggestions] = useState<AddressSuggestion[]>([]);
  const [heroLocationOpen, setHeroLocationOpen] = useState(false);
  const [heroLocationLoading, setHeroLocationLoading] = useState(false);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [difficulty, setDifficulty] = useState<Difficulty | "All">("All");
  const [categoryIds, setCategoryIds] = useState<string[]>([]);
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [sort, setSort] = useState<"popular" | "soonest" | "priceAsc" | "priceDesc">("popular");

  const [scrolled, setScrolled] = useState(false);
  const [showCompactSearch, setShowCompactSearch] = useState(false);
  const [heroVisible, setHeroVisible] = useState(true);
  const resultsRef = useRef<HTMLElement>(null);
  const heroRef = useRef<HTMLElement>(null);
  const requestSeqRef = useRef(0);

  useEffect(() => {
    const handleScroll = () => {
      const heroBottom = heroRef.current
        ? heroRef.current.getBoundingClientRect().bottom
        : 320;

      setScrolled(window.scrollY > 80);
      setShowCompactSearch(heroBottom < 80);
      setHeroVisible(heroBottom > 0);
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

  useEffect(() => {
    const trimmed = locationInput.trim();
    if (!trimmed) {
      setHeroLocationSuggestions([]);
      setHeroLocationOpen(false);
      return;
    }

    const handle = window.setTimeout(async () => {
      try {
        setHeroLocationLoading(true);
        const data = await suggestPublicAddresses(trimmed);
        setHeroLocationSuggestions(data ?? []);
        setHeroLocationOpen((data ?? []).length > 0);
      } catch {
        setHeroLocationSuggestions([]);
      } finally {
        setHeroLocationLoading(false);
      }
    }, 280);

    return () => window.clearTimeout(handle);
  }, [locationInput]);

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

  const isAiSearch = queryInput.trim().length > 0;

  const fetchTemplatesPage = async (
    pageToLoad: number,
    mode: "replace" | "append",
    requestSeq: number
  ) => {
    const trimmedQuery = queryInput.trim();

    if (mode === "replace") {
      setState("loading");
    } else {
      setLoadingMore(true);
    }

    try {
      let content: PublicTemplateCard[] = [];
      let responsePage = pageToLoad;
      let responseLast = true;
      let responseTotal = 0;

      if (trimmedQuery) {
        const results = await semanticSearchPage(
          {
            query: trimmedQuery,
            addressId: selectedAddressId || undefined,
            limit: PAGE_SIZE,
            difficulty: difficulty === "All" ? undefined : difficulty,
            categoryId: categoryIds.length === 1 ? categoryIds[0] : undefined,
            minPrice: minPrice ? Number(minPrice) : undefined,
            maxPrice: maxPrice ? Number(maxPrice) : undefined,
            dateFrom: dateFrom ? new Date(`${dateFrom}T00:00:00`).toISOString() : undefined,
            dateTo: dateTo ? new Date(`${dateTo}T23:59:59`).toISOString() : undefined,
            sort,
          },
          pageToLoad,
          PAGE_SIZE
        );

        const filteredResults =
          categoryIds.length > 1
            ? results.content.filter((r) =>
                categoryIds.every((id) => (r.categoryIds ?? []).includes(id))
              )
            : results.content;

        content = filteredResults.map(semanticItemToTemplateCard);
        responsePage = results.page;
        responseLast = results.last;
        responseTotal = results.totalElements;
      } else if (hasActiveFilters) {
        const results = await searchPublicTemplatesPage(
          {
            addressId: selectedAddressId || undefined,
            categoryIds: categoryIds.length > 0 ? categoryIds : undefined,
            minPrice: minPrice ? Number(minPrice) : undefined,
            maxPrice: maxPrice ? Number(maxPrice) : undefined,
            difficulty: difficulty === "All" ? undefined : difficulty,
            dateFrom: dateFrom ? new Date(`${dateFrom}T00:00:00`).toISOString() : undefined,
            dateTo: dateTo ? new Date(`${dateTo}T23:59:59`).toISOString() : undefined,
            sort,
          },
          pageToLoad,
          PAGE_SIZE
        );

        content = results.content;
        responsePage = results.page;
        responseLast = results.last;
        responseTotal = results.totalElements;
      } else {
        const results = await listPublicTemplatesPage(pageToLoad, PAGE_SIZE);
        content = results.content;
        responsePage = results.page;
        responseLast = results.last;
        responseTotal = results.totalElements;
      }

      if (requestSeqRef.current !== requestSeq) {
        return;
      }

      setTemplates((prev) => {
        if (mode === "replace") {
          return content;
        }

        const existingIds = new Set(prev.map((item) => item.id));
        return [...prev, ...content.filter((item) => !existingIds.has(item.id))];
      });
      setPage(responsePage);
      setLastPage(responseLast);
      setTotalElements(responseTotal);
      setState("done");
    } catch (err) {
      console.error("Failed to search templates", err);
      if (requestSeqRef.current === requestSeq) {
        if (mode === "replace") {
          setTemplates([]);
          setState("error");
        } else {
          setState("done");
        }
      }
    } finally {
      if (requestSeqRef.current === requestSeq) {
        setLoadingMore(false);
      }
    }
  };

  useEffect(() => {
    const requestSeq = requestSeqRef.current + 1;
    requestSeqRef.current = requestSeq;
    setPage(0);
    setLastPage(true);
    setTotalElements(0);

    const handle = window.setTimeout(() => {
      void fetchTemplatesPage(0, "replace", requestSeq);
    }, 260);

    return () => {
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
    hasActiveFilters,
  ]);

  const handleLoadMore = () => {
    if (loadingMore || state === "loading" || lastPage) {
      return;
    }

    const requestSeq = requestSeqRef.current;
    void fetchTemplatesPage(page + 1, "append", requestSeq);
  };

  const handleLocationSelect = (address: AddressSuggestion) => {
    setLocationInput(address.displayName);
    setSelectedAddressId(address.id);
    setHeroLocationOpen(false);
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

  const handleQuickSuggestion = (label: string) => {
    const categoryName = label === "MTB" ? "Mountain Biking" : label;
    const matchingCategory = categories.find(
      (category) => category.name.trim().toLowerCase() === categoryName.toLowerCase()
    );

    if (matchingCategory) {
      handleToggleCategory(matchingCategory.id);
      setQueryInput("");
    } else {
      setQueryInput(categoryName);
    }
    scrollToResults();
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
        {/* Compact hero */}
        <section
          ref={heroRef}
          className={`${styles.heroCinematic} ${!heroVisible ? styles.homeHeroHidden : ""}`}
        >
          {/* Subtle decorative background blobs */}
          <div className={styles.heroBlob1} aria-hidden="true" />
          <div className={styles.heroBlob2} aria-hidden="true" />
          <div className={styles.heroShell}>
            <div className={styles.heroLeft}>
              <div className={styles.heroTrustPill}>
                <span className={styles.trustDot} />
                100+ sessions - 25+ local guides - Tunisia-based
              </div>

              <h1 className={styles.heroHeadline}>
                <span>The world is wild.</span>
                <span className={styles.heroAccent}>Go find it.</span>
              </h1>

              <p className={styles.heroSubtitle}>
                Book guided outdoor experiences across Tunisia, from desert camps to mountain ridges and wild coastlines.
              </p>

              <form
                className={styles.heroSearchCard}
                onSubmit={(event) => {
                  event.preventDefault();
                  scrollToResults();
                }}
              >
                <div className={styles.heroSearchPill}>
                  <label className={styles.heroSearchField}>
                    <span>What</span>
                    <input
                      value={queryInput}
                      placeholder="Hiking, camping, surfing..."
                      onChange={(event) => setQueryInput(event.target.value)}
                    />
                  </label>

                  <label className={`${styles.heroSearchField} ${styles.heroLocationField}`}>
                    <span>Where</span>
                    <input
                      value={locationInput}
                      placeholder="Any destination"
                      onFocus={() => {
                        if (heroLocationSuggestions.length > 0) setHeroLocationOpen(true);
                      }}
                      onChange={(event) => handleLocationInputChange(event.target.value)}
                    />
                    {heroLocationLoading && <em className={styles.heroFieldLoading}>...</em>}
                    {heroLocationOpen && heroLocationSuggestions.length > 0 && (
                      <div className={styles.heroLocationMenu}>
                        {heroLocationSuggestions.map((item) => (
                          <button
                            type="button"
                            key={item.id}
                            onMouseDown={(event) => event.preventDefault()}
                            onClick={() => handleLocationSelect(item)}
                          >
                            {item.displayName}
                          </button>
                        ))}
                      </div>
                    )}
                  </label>

                  <label className={styles.heroSearchField}>
                    <span>From</span>
                    <input
                      type="date"
                      value={dateFrom}
                      min={new Date().toISOString().split("T")[0]}
                      onChange={(event) => setDateFrom(event.target.value)}
                    />
                  </label>

                  <label className={styles.heroSearchField}>
                    <span>To</span>
                    <input
                      type="date"
                      value={dateTo}
                      min={dateFrom || new Date().toISOString().split("T")[0]}
                      onChange={(event) => setDateTo(event.target.value)}
                    />
                  </label>

                  <button type="submit" className={styles.heroSearchSubmit} aria-label="Search experiences">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <circle cx="11" cy="11" r="8" />
                      <path d="m21 21-4.35-4.35" />
                    </svg>
                    <span>Search</span>
                  </button>
                </div>
              </form>

              <div className={styles.heroQuickChips}>
                <span>TRY:</span>
                {QUICK_SUGGESTIONS.map((label) => {
                  const categoryName = label === "MTB" ? "Mountain Biking" : label;
                  const matchingCategory = categories.find(
                    (category) => category.name.trim().toLowerCase() === categoryName.toLowerCase()
                  );
                  const selected = matchingCategory
                    ? categoryIds.includes(matchingCategory.id)
                    : queryInput === categoryName;

                  return (
                    <button
                      key={label}
                      type="button"
                      className={selected ? styles.heroChipActive : ""}
                      onClick={() => handleQuickSuggestion(label)}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>

              <div className={styles.heroStats}>
                <div><strong>100+</strong><span>Sessions</span></div>
                <div><strong>25+</strong><span>Local guides</span></div>
                <div><strong>4.8</strong><span>Avg rating</span></div>
              </div>

              {state === "done" && hasActiveFilters && (
                <div className={styles.resultsPill}>
                  <span className={styles.resultsPillDot} />
                  <span>
                    <strong>{templates.length}</strong> of {totalElements || templates.length}{" "}
                    {templates.length === 1 ? "experience" : "experiences"} found
                  </span>
                  {templates.length > 0 && (
                    <button type="button" className={styles.seeResultsBtn} onClick={scrollToResults}>
                      See results down
                    </button>
                  )}
                </div>
              )}
            </div>

            <div className={styles.heroRight} aria-label="Adventure highlights">
              <div className={`${styles.heroFloatingCard} ${styles.heroAvailabilityCard}`}>
                <span className={styles.heroPulseDot} />
                <div><strong>Next available</strong><span>Douz - 4 spots left</span></div>
              </div>
              <div className={`${styles.heroFloatingCard} ${styles.heroRatingCard}`}>
                <strong>4.8</strong><span>Top rated</span><em>Local guide reviews</em>
              </div>
              <div className={`${styles.heroFloatingCard} ${styles.heroDestinationCard}`}>
                100+ sessions
              </div>

              <div className={styles.heroMosaic}>
                {HERO_VISUAL_CARDS.map((card) => (
                  <article key={card.title} className={`${styles.heroScene} ${styles[card.className]}`}>
                    <span>{card.meta}</span>
                    <div className={styles.sceneCopy}>
                      <strong>{card.title}</strong>
                      <em>{card.status}</em>
                    </div>
                    <i className={styles.sceneSun} />
                    <i className={styles.scenePerson} />
                  </article>
                ))}
              </div>

              <div className={`${styles.heroFloatingCard} ${styles.heroGuideCard}`}>
                <span>KB</span>
                <div>
                  <strong>Karim B.</strong>
                  <small>Top-rated certified desert guide - 7yr</small>
                  <em>Verified - 340 trips</em>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Smart discovery bar */}
        <SmartDiscoveryBar
          difficulty={difficulty}
          categoryIds={categoryIds}
          sort={sort}
          minPrice={minPrice}
          maxPrice={maxPrice}
          dateFrom={dateFrom}
          dateTo={dateTo}
          categories={categoryOptions}
          resultCount={state === "done" ? totalElements || templates.length : undefined}
          hasActiveFilters={hasActiveFilters}
          searchQuery={queryInput.trim()}
          isLoggedIn={!!user}
          onDifficultyChange={setDifficulty}
          onToggleCategory={handleToggleCategory}
          onSortChange={setSort}
          onMinPriceChange={setMinPrice}
          onMaxPriceChange={setMaxPrice}
          onDateFromChange={setDateFrom}
          onDateToChange={setDateTo}
          onClearAll={handleClearFilters}
        />

        {/* AI recommended */}
        {user && (
          <section className={styles.activitiesSection}>
            <div className={styles.container}>
              <RecommendedActivities title="Recommended for you" limit={6} />
            </div>
          </section>
        )}

        {/* Results section */}
        <section ref={resultsRef} className={styles.activitiesSection}>
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
                        : `${totalElements || templates.length} ${
                            (totalElements || templates.length) === 1 ? "experience" : "experiences"
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
                      <option value="priceAsc">Price: low to high</option>
                      <option value="priceDesc">Price: high to low</option>
                    </select>
                  </div>
                </div>

                <div className={styles.activityGrid}>
                  {templates.map((t, index) => (
                    <ActivityCard key={t.id} activity={t} index={index} />
                  ))}
                </div>

                {!lastPage && (
                  <div className={styles.loadMoreWrap}>
                    <button
                      type="button"
                      className={styles.btnSecondary}
                      onClick={handleLoadMore}
                      disabled={loadingMore}
                    >
                      {loadingMore ? "Loading..." : "Load more"}
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </section>
      </main>
    </>
  );
}


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
  type TemplateSearchParams,
  listPublicTemplatesPage,
  searchPublicTemplatesPage,
  suggestPublicAddresses,
} from "../api/activity.api";
import { listCategories } from "../api/category.api";
import { HeroSearchBar } from "../components/search/HeroSearchBar";
import {
  semanticSearchPage,
  type SemanticSearchItem,
  type SemanticSearchRequest,
} from "../api/search.api";
import ChatAssistantWidget from "../components/assistant/ChatAssistantWidget";

// ─── types & constants ──────────────────────────────────────────────────────

type LoadState = "idle" | "loading" | "error" | "done";
const PAGE_SIZE = 12;
const MIN_LOCATION_QUERY_LENGTH = 2;

const HERO_VISUAL_CARDS = [
  { title: "Douz Desert Camp",        meta: "DOUZ - EASY",        status: "4 spots left",    className: "sceneDesert" },
  { title: "Cap Serrat Surf Morning", meta: "CAP SERRAT - BEGINNER", status: "Open this week", className: "sceneOcean"  },
  { title: "Zaghouan Mountain Hike",  meta: "ZAGHOUAN - MODERATE",  status: "Local guide",     className: "sceneForest" },
  { title: "Chebika Waterfall Trek",  meta: "CHEBIKA - MODERATE",   status: "Small group",     className: "sceneOasis"  },
];

const SORT_OPTIONS: { value: "popular" | "soonest" | "priceAsc" | "priceDesc"; label: string }[] = [
  { value: "popular",   label: "Most popular" },
  { value: "soonest",   label: "Soonest" },
  { value: "priceAsc",  label: "Price: low → high" },
  { value: "priceDesc", label: "Price: high → low" },
];

// ─── helpers ─────────────────────────────────────────────────────────────────

function useDebouncedValue<T>(value: T, delay: number) {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const handle = window.setTimeout(() => setDebouncedValue(value), delay);
    return () => window.clearTimeout(handle);
  }, [value, delay]);
  return debouncedValue;
}

function semanticItemToTemplateCard(item: SemanticSearchItem): PublicTemplateCard {
  return {
    id: item.templateId,
    title: item.title,
    description: item.description,
    difficulty: ((item.difficulty ?? "EASY").toUpperCase() as Difficulty),
    price: item.price ?? 0,
    tags: [],
    coverImageUrl: item.coverImageUrl ?? null,
    rating: { average: item.ratingAverage ?? 0, count: item.ratingCount ?? 0 },
    nextSession: item.nextSessionDate
      ? { sessionId: `next-${item.templateId}`, date: item.nextSessionDate, capacity: 0, bookedCount: 0 }
      : null,
    upcomingSessionsCount: item.nextSessionDate ? 1 : 0,
    images: item.coverImageUrl
      ? [{ url: item.coverImageUrl, publicId: null, alt: item.title, cover: true, order: 0 }]
      : [],
    addressDisplayName: null,
    governorate: null,
    latitude: null,
    longitude: null,
    totalBookedCount: 0,
    guide: null,
  };
}

// ─── filter modal (inline, no new library) ───────────────────────────────────

type FilterModalProps = {
  open: boolean;
  difficulty: Difficulty | "All";
  minPrice: string;
  maxPrice: string;
  onDifficultyChange: (v: Difficulty | "All") => void;
  onMinPriceChange: (v: string) => void;
  onMaxPriceChange: (v: string) => void;
  onClose: () => void;
  onApply: () => void;
};

function FilterModal({
  open, difficulty, minPrice, maxPrice,
  onDifficultyChange, onMinPriceChange, onMaxPriceChange,
  onClose, onApply,
}: FilterModalProps) {
  if (!open) return null;
  const difficulties: (Difficulty | "All")[] = ["All", "EASY", "MEDIUM", "HARD"];

  return (
    <div className={styles.filterOverlay} onClick={onClose}>
      <div className={styles.filterModal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.filterModalHeader}>
          <h3>Filters</h3>
          <button type="button" onClick={onClose} aria-label="Close filters">×</button>
        </div>

        <div className={styles.filterModalBody}>
          <p className={styles.filterLabel}>Difficulty</p>
          <div className={styles.filterChipRow}>
            {difficulties.map((d) => (
              <button
                key={d}
                type="button"
                className={`${styles.filterChip} ${difficulty === d ? styles.filterChipActive : ""}`}
                onClick={() => onDifficultyChange(d)}
              >
                {d === "All" ? "Any" : d.charAt(0) + d.slice(1).toLowerCase()}
              </button>
            ))}
          </div>

          <p className={styles.filterLabel}>Price range (TND)</p>
          <div className={styles.filterPriceRow}>
            <input
              type="number"
              className={styles.filterPriceInput}
              placeholder="Min"
              min={0}
              value={minPrice}
              onChange={(e) => onMinPriceChange(e.target.value)}
            />
            <span className={styles.filterPriceSep}>–</span>
            <input
              type="number"
              className={styles.filterPriceInput}
              placeholder="Max"
              min={0}
              value={maxPrice}
              onChange={(e) => onMaxPriceChange(e.target.value)}
            />
          </div>
        </div>

        <div className={styles.filterModalFooter}>
          <button
            type="button"
            className={styles.btnSecondary}
            onClick={() => { onDifficultyChange("All"); onMinPriceChange(""); onMaxPriceChange(""); }}
          >
            Reset
          </button>
          <button type="button" className={styles.filterApplyBtn} onClick={onApply}>
            Apply
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── main component ──────────────────────────────────────────────────────────

export default function HomePage() {
  const { user } = useAuth();

  // ── result state ──
  const [state, setState] = useState<LoadState>("idle");
  const [templates, setTemplates] = useState<PublicTemplateCard[]>([]);
  const [page, setPage] = useState(0);
  const [lastPage, setLastPage] = useState(true);
  const [totalElements, setTotalElements] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);

  // ── filter state ──
  const [queryInput, setQueryInput] = useState("");
  const [locationInput, setLocationInput] = useState("");
  // selectedAddressId kept in state but NOT passed to public search (broad q= is used instead)
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
  const [filterModalOpen, setFilterModalOpen] = useState(false);

  // ── layout state ──
  const [scrolled, setScrolled] = useState(false);
  const [showCompactSearch, setShowCompactSearch] = useState(false);
  const [heroVisible, setHeroVisible] = useState(true);
  const resultsRef = useRef<HTMLElement>(null);
  const heroRef = useRef<HTMLElement>(null);

  // ── dedup refs ──
  const requestSeqRef = useRef(0);
  const suggestionSeqRef = useRef(0);
  const lastSearchKeyRef = useRef("");
  const lastSuggestionQueryRef = useRef("");

  // ── debounced values ──
  const debouncedLocationForSuggestions = useDebouncedValue(locationInput, 300);
  const searchState = useMemo(
    () => ({ queryInput, locationInput, categoryIds, minPrice, maxPrice, difficulty, dateFrom, dateTo, sort }),
    [queryInput, locationInput, categoryIds, minPrice, maxPrice, difficulty, dateFrom, dateTo, sort]
  );
  const debouncedSearchState = useDebouncedValue(searchState, 650);

  const normalizeSuggestionQuery = (value: string) => value.trim().toLowerCase();

  const categoryOptions = useMemo(() => categories.map((c) => ({ id: c.id, label: c.name })), [categories]);

  const heroSimpleLocationSuggestions = useMemo(() => {
    const seen = new Set<string>();
    return heroLocationSuggestions.filter((address) => {
      const key = address.displayName.trim().toLowerCase();
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [heroLocationSuggestions]);

  const hasActiveFilters = useMemo(
    () => Boolean(
      queryInput.trim() || locationInput.trim() || dateFrom || dateTo ||
      categoryIds.length > 0 || minPrice || maxPrice || difficulty !== "All" || sort !== "popular"
    ),
    [queryInput, locationInput, dateFrom, dateTo, categoryIds, minPrice, maxPrice, difficulty, sort]
  );

  const isAiSearch = queryInput.trim().length > 0;

  // ── scroll tracking ──
  useEffect(() => {
    const handleScroll = () => {
      const heroBottom = heroRef.current ? heroRef.current.getBoundingClientRect().bottom : 320;
      setScrolled(window.scrollY > 80);
      setShowCompactSearch(heroBottom < 80);
      setHeroVisible(heroBottom > 0);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // ── load categories ──
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await listCategories();
        if (!cancelled) setCategories(data ?? []);
      } catch (err) {
        console.error("Failed to load categories", err);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // ── address suggestions ──
  useEffect(() => {
    const trimmed = debouncedLocationForSuggestions.trim();
    if (trimmed.length < MIN_LOCATION_QUERY_LENGTH) {
      lastSuggestionQueryRef.current = "";
      setHeroLocationSuggestions([]);
      setHeroLocationOpen(false);
      return;
    }
    const suggestionKey = normalizeSuggestionQuery(trimmed);
    if (lastSuggestionQueryRef.current === suggestionKey) return;
    lastSuggestionQueryRef.current = suggestionKey;
    const requestId = suggestionSeqRef.current + 1;
    suggestionSeqRef.current = requestId;

    console.log("[HOME_API_CALL]", { type: "suggest", key: suggestionKey, q: trimmed, reason: "debounced-location" });

    (async () => {
      try {
        setHeroLocationLoading(true);
        const data = await suggestPublicAddresses(trimmed);
        if (suggestionSeqRef.current !== requestId) return;
        setHeroLocationSuggestions(data ?? []);
        setHeroLocationOpen((data ?? []).length > 0);
      } catch {
        if (suggestionSeqRef.current !== requestId) return;
        setHeroLocationSuggestions([]);
      } finally {
        if (suggestionSeqRef.current === requestId) setHeroLocationLoading(false);
      }
    })();
  }, [debouncedLocationForSuggestions]);

  // ── fetch logic ──
  const fetchTemplatesPage = async (pageToLoad: number, mode: "replace" | "append", requestSeq: number) => {
    const trimmedQuery    = debouncedSearchState.queryInput.trim();
    const trimmedLocation = debouncedSearchState.locationInput.trim();
    const hasPublicSearchFilters = Boolean(
      trimmedLocation || debouncedSearchState.categoryIds.length > 0 ||
      debouncedSearchState.minPrice || debouncedSearchState.maxPrice ||
      debouncedSearchState.difficulty !== "All" || debouncedSearchState.dateFrom ||
      debouncedSearchState.dateTo || debouncedSearchState.sort !== "popular"
    );

    if (mode === "replace") setState("loading"); else setLoadingMore(true);

    try {
      let content: PublicTemplateCard[] = [];
      let responsePage  = pageToLoad;
      let responseLast  = true;
      let responseTotal = 0;
      let branch: "semantic" | "filtered-public-search" | "public-list" = "public-list";
      let params: Record<string, unknown> = {};

      if (trimmedQuery) {
        branch = "semantic";
        const semanticParams: SemanticSearchRequest = {
          query: trimmedQuery,
          // selectedAddressId intentionally NOT used for homepage public search
          addressId: undefined,
          limit: PAGE_SIZE,
          difficulty: debouncedSearchState.difficulty === "All" ? undefined : debouncedSearchState.difficulty,
          categoryId: debouncedSearchState.categoryIds.length === 1 ? debouncedSearchState.categoryIds[0] : undefined,
          minPrice:  debouncedSearchState.minPrice  ? Number(debouncedSearchState.minPrice)  : undefined,
          maxPrice:  debouncedSearchState.maxPrice  ? Number(debouncedSearchState.maxPrice)  : undefined,
          dateFrom:  debouncedSearchState.dateFrom  ? new Date(`${debouncedSearchState.dateFrom}T00:00:00`).toISOString()  : undefined,
          dateTo:    debouncedSearchState.dateTo    ? new Date(`${debouncedSearchState.dateTo}T23:59:59`).toISOString()    : undefined,
          sort: debouncedSearchState.sort,
        };
        params = { ...semanticParams, page: pageToLoad, size: PAGE_SIZE };
        const results = await semanticSearchPage(semanticParams, pageToLoad, PAGE_SIZE);
        const filteredResults = debouncedSearchState.categoryIds.length > 1
          ? results.content.filter((r) => debouncedSearchState.categoryIds.every((id) => (r.categoryIds ?? []).includes(id)))
          : results.content;
        content       = filteredResults.map(semanticItemToTemplateCard);
        responsePage  = results.page;
        responseLast  = results.last;
        responseTotal = results.totalElements;

      } else if (hasPublicSearchFilters) {
        branch = "filtered-public-search";
        const searchParams: TemplateSearchParams = {
          // Use broad text q= for location — NOT addressId
          q:          trimmedLocation || undefined,
          addressId:  undefined,
          categoryIds: debouncedSearchState.categoryIds.length > 0 ? debouncedSearchState.categoryIds : undefined,
          minPrice:   debouncedSearchState.minPrice   ? Number(debouncedSearchState.minPrice)   : undefined,
          maxPrice:   debouncedSearchState.maxPrice   ? Number(debouncedSearchState.maxPrice)   : undefined,
          difficulty: debouncedSearchState.difficulty === "All" ? undefined : debouncedSearchState.difficulty,
          dateFrom:   debouncedSearchState.dateFrom   ? new Date(`${debouncedSearchState.dateFrom}T00:00:00`).toISOString()   : undefined,
          dateTo:     debouncedSearchState.dateTo     ? new Date(`${debouncedSearchState.dateTo}T23:59:59`).toISOString()     : undefined,
          sort: debouncedSearchState.sort,
        };
        params = { ...searchParams, page: pageToLoad, size: PAGE_SIZE };
        const results = await searchPublicTemplatesPage(searchParams, pageToLoad, PAGE_SIZE);
        content       = results.content;
        responsePage  = results.page;
        responseLast  = results.last;
        responseTotal = results.totalElements;

      } else {
        params = { page: pageToLoad, size: PAGE_SIZE };
        const results = await listPublicTemplatesPage(pageToLoad, PAGE_SIZE);
        content       = results.content;
        responsePage  = results.page;
        responseLast  = results.last;
        responseTotal = results.totalElements;
      }

      if (requestSeqRef.current !== requestSeq) return;

      console.log("[HOME_SEARCH]", {
        branch, queryInput: trimmedQuery, locationInput: trimmedLocation,
        params, totalElements: responseTotal || content.length,
      });

      setTemplates((prev) => {
        if (mode === "replace") return content;
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
        if (mode === "replace") { setTemplates([]); setState("error"); }
        else setState("done");
      }
    } finally {
      if (requestSeqRef.current === requestSeq) setLoadingMore(false);
    }
  };

  // ── auto-search on filter change ──
  useEffect(() => {
    const trimmedQuery    = debouncedSearchState.queryInput.trim();
    const trimmedLocation = debouncedSearchState.locationInput.trim();
    const hasPublicSearchFilters = Boolean(
      trimmedLocation || debouncedSearchState.categoryIds.length > 0 ||
      debouncedSearchState.minPrice || debouncedSearchState.maxPrice ||
      debouncedSearchState.difficulty !== "All" || debouncedSearchState.dateFrom ||
      debouncedSearchState.dateTo || debouncedSearchState.sort !== "popular"
    );
    const branch = trimmedQuery ? "semantic" : hasPublicSearchFilters ? "filtered-public-search" : "public-list";
    const searchKey = JSON.stringify({
      branch,
      query:      trimmedQuery,
      q:          trimmedLocation || undefined,
      categoryIds: debouncedSearchState.categoryIds,
      minPrice:   debouncedSearchState.minPrice,
      maxPrice:   debouncedSearchState.maxPrice,
      difficulty: debouncedSearchState.difficulty,
      dateFrom:   debouncedSearchState.dateFrom,
      dateTo:     debouncedSearchState.dateTo,
      sort:       debouncedSearchState.sort,
      page: 0, size: PAGE_SIZE,
    });

    if (searchKey === lastSearchKeyRef.current) return;
    lastSearchKeyRef.current = searchKey;
    const requestSeq = requestSeqRef.current + 1;
    requestSeqRef.current = requestSeq;
    setPage(0);
    setLastPage(true);
    setTotalElements(0);

    console.log("[HOME_API_CALL]", {
      type: branch === "public-list" ? "public-list" : branch === "semantic" ? "semantic" : "search",
      key: searchKey, q: trimmedLocation || undefined, page: 0, reason: "debounced-search-params",
    });

    void fetchTemplatesPage(0, "replace", requestSeq);
  }, [debouncedSearchState]);
  // Note: selectedAddressId intentionally NOT in dep array — not used for homepage search

  // ── handlers ──
  const handleLoadMore = () => {
    if (loadingMore || state === "loading" || lastPage) return;
    void fetchTemplatesPage(page + 1, "append", requestSeqRef.current);
  };

  const handleLocationSelect = (address: AddressSuggestion) => {
    setLocationInput(address.displayName);
    setSelectedAddressId(null); // kept in state but not used in public search
    lastSuggestionQueryRef.current = normalizeSuggestionQuery(address.displayName);
    setHeroLocationSuggestions([]);
    setHeroLocationOpen(false);
  };

  const handleLocationInputChange = (value: string) => {
    setLocationInput(value);
    setSelectedAddressId(null);
    if (value.trim().length >= MIN_LOCATION_QUERY_LENGTH) setHeroLocationOpen(true);
  };

  const handleToggleCategory = (id: string) => {
    setCategoryIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  };

  const handleClearFilters = () => {
    setQueryInput("");
    setLocationInput("");
    setSelectedAddressId(null);
    setHeroLocationSuggestions([]);
    setHeroLocationOpen(false);
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

  // ── active filter chip labels ──
  const activeFilterChips = useMemo(() => {
    const chips: { key: string; label: string; onRemove: () => void }[] = [];

    if (queryInput.trim()) {
      chips.push({ key: "query", label: `"${queryInput.trim()}"`, onRemove: () => setQueryInput("") });
    }
    if (locationInput.trim()) {
      chips.push({ key: "location", label: `📍 ${locationInput.trim()}`, onRemove: () => { setLocationInput(""); setSelectedAddressId(null); } });
    }
    if (dateFrom || dateTo) {
      const label = dateFrom && dateTo ? `${dateFrom} → ${dateTo}` : dateFrom ? `From ${dateFrom}` : `To ${dateTo}`;
      chips.push({ key: "date", label: `📅 ${label}`, onRemove: () => { setDateFrom(""); setDateTo(""); } });
    }
    categoryIds.forEach((id) => {
      const cat = categories.find((c) => c.id === id);
      if (cat) {
        chips.push({ key: `cat-${id}`, label: cat.name, onRemove: () => handleToggleCategory(id) });
      }
    });
    if (difficulty !== "All") {
      const label = difficulty.charAt(0) + difficulty.slice(1).toLowerCase();
      chips.push({ key: "difficulty", label: `⚡ ${label}`, onRemove: () => setDifficulty("All") });
    }
    if (minPrice || maxPrice) {
      const label = minPrice && maxPrice ? `${minPrice}–${maxPrice} TND` : minPrice ? `≥ ${minPrice} TND` : `≤ ${maxPrice} TND`;
      chips.push({ key: "price", label: `💰 ${label}`, onRemove: () => { setMinPrice(""); setMaxPrice(""); } });
    }

    return chips;
  }, [queryInput, locationInput, dateFrom, dateTo, categoryIds, difficulty, minPrice, maxPrice, categories]);

  // ── render ──
  return (
    <>
      <div
        className={`${styles.headerWrap} ${scrolled ? styles.headerWrapScrolled : styles.headerWrapHero}`}
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
                suggestionsEnabled={false}
                compact
              />
            ) : null
          }
        />
      </div>

      <main className={styles.home}>

        {/* ── HERO ── */}
        <section
          ref={heroRef}
          className={`${styles.heroCinematic} ${!heroVisible ? styles.homeHeroHidden : ""}`}
        >
          <div className={styles.heroBlob1} aria-hidden="true" />
          <div className={styles.heroBlob2} aria-hidden="true" />
          <div className={styles.heroShell}>
            <div className={styles.heroLeft}>
              <div className={styles.heroTrustPill}>
                <span className={styles.trustDot} />
                100+ sessions · 25+ local guides · Tunisia-based
              </div>

              <h1 className={styles.heroHeadline}>
                <span>The world is wild.</span>
                <span className={styles.heroAccent}>Go find it.</span>
              </h1>

              <p className={styles.heroSubtitle}>
                Book guided outdoor experiences across Tunisia — from desert camps to mountain ridges and wild coastlines.
              </p>

              {/* ── Hero search form ── */}
              <form
                className={styles.heroSearchCard}
                onSubmit={(e) => { e.preventDefault(); scrollToResults(); }}
              >
                <div className={styles.heroSearchPill}>
                  <label className={styles.heroSearchField}>
                    <span>What</span>
                    <input
                      value={queryInput}
                      placeholder="Hiking, camping, surfing..."
                      onChange={(e) => setQueryInput(e.target.value)}
                    />
                  </label>

                  <label className={`${styles.heroSearchField} ${styles.heroLocationField}`}>
                    <span>Where</span>
                    <input
                      value={locationInput}
                      placeholder="Any destination"
                      onFocus={() => { if (heroSimpleLocationSuggestions.length > 0) setHeroLocationOpen(true); }}
                      onChange={(e) => handleLocationInputChange(e.target.value)}
                    />
                    {heroLocationLoading && <em className={styles.heroFieldLoading}>...</em>}
                    {heroLocationOpen && heroSimpleLocationSuggestions.length > 0 && (
                      <div className={styles.heroLocationMenu}>
                        {heroSimpleLocationSuggestions.map((item) => (
                          <button
                            type="button"
                            key={item.id}
                            onMouseDown={(e) => e.preventDefault()}
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
                      onChange={(e) => setDateFrom(e.target.value)}
                    />
                  </label>

                  <label className={styles.heroSearchField}>
                    <span>To</span>
                    <input
                      type="date"
                      value={dateTo}
                      min={dateFrom || new Date().toISOString().split("T")[0]}
                      onChange={(e) => setDateTo(e.target.value)}
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

              {/* ── REMOVED: heroQuickChips (Hiking, Surfing, Diving, Camping, MTB) ── */}

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
                      See results
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

        {/* ── CONTROLS BAR (replaces SmartDiscoveryBar clutter) ── */}
        <div className={styles.controlsBar}>
          <div className={styles.controlsBarInner}>
            {/* Category chips */}
            <div className={styles.categoryChipRow}>
              {categoryOptions.map(({ id, label }) => (
                <button
                  key={id}
                  type="button"
                  className={`${styles.categoryChip} ${categoryIds.includes(id) ? styles.categoryChipActive : ""}`}
                  onClick={() => handleToggleCategory(id)}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Right controls */}
            <div className={styles.controlsRight}>
              {/* Filters button */}
              <button
                type="button"
                className={`${styles.filtersBtn} ${(difficulty !== "All" || minPrice || maxPrice) ? styles.filtersBtnActive : ""}`}
                onClick={() => setFilterModalOpen(true)}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
                  <line x1="4" y1="6" x2="20" y2="6" />
                  <line x1="8" y1="12" x2="16" y2="12" />
                  <line x1="11" y1="18" x2="13" y2="18" />
                </svg>
                Filters
                {(difficulty !== "All" || minPrice || maxPrice) && (
                  <span className={styles.filtersBadge} />
                )}
              </button>

              {/* Single sort dropdown */}
              <div className={styles.sortInline}>
                <label className={styles.sortLabel} htmlFor="hp-sort">Sort:</label>
                <select
                  id="hp-sort"
                  className={styles.sortSelect}
                  value={sort}
                  onChange={(e) => setSort(e.target.value as typeof sort)}
                >
                  {SORT_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* ── RESULTS SECTION ── */}
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
                {/* Results header */}
                <div className={styles.sectionHeader}>
                  <div>
                    <h2 className={styles.sectionTitle}>
                      {isAiSearch ? "AI-powered results" : "Available Experiences"}
                    </h2>
                    <p className={styles.sectionSubtitle}>
                      {isAiSearch
                        ? "Results based on meaning — with your filters applied"
                        : `${totalElements || templates.length} ${
                            (totalElements || templates.length) === 1 ? "experience" : "experiences"
                          } waiting for you`}
                    </p>
                  </div>

                  {/* Inline sort (results area — single sort control, controls bar sort syncs same state) */}
                  <div className={styles.sortInline}>
                    <label className={styles.sortLabel} htmlFor="hp-sort-results">Sort:</label>
                    <select
                      id="hp-sort-results"
                      className={styles.sortSelect}
                      value={sort}
                      onChange={(e) => setSort(e.target.value as typeof sort)}
                    >
                      {SORT_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Active filter chips */}
                {activeFilterChips.length > 0 && (
                  <div className={styles.activeFilterChips}>
                    {activeFilterChips.map((chip) => (
                      <button
                        key={chip.key}
                        type="button"
                        className={styles.activeChip}
                        onClick={chip.onRemove}
                        aria-label={`Remove filter: ${chip.label}`}
                      >
                        {chip.label}
                        <span className={styles.activeChipX} aria-hidden>×</span>
                      </button>
                    ))}
                    {activeFilterChips.length > 1 && (
                      <button type="button" className={styles.clearAllChip} onClick={handleClearFilters}>
                        Clear all
                      </button>
                    )}
                  </div>
                )}

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

        {/* ── RECOMMENDED (below results, visually separate, logged-in only) ── */}
        {user && (
          <section className={styles.recommendedSection}>
            <div className={styles.container}>
              <RecommendedActivities title="Recommended for you" limit={6} />
            </div>
          </section>
        )}

      </main>

      {/* ── FILTER MODAL ── */}
      <FilterModal
        open={filterModalOpen}
        difficulty={difficulty}
        minPrice={minPrice}
        maxPrice={maxPrice}
        onDifficultyChange={setDifficulty}
        onMinPriceChange={setMinPrice}
        onMaxPriceChange={setMaxPrice}
        onClose={() => setFilterModalOpen(false)}
        onApply={() => setFilterModalOpen(false)}
      />
      {user && <ChatAssistantWidget mode="general" />}
    </>
  );
}

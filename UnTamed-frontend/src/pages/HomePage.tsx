import { useEffect, useMemo, useState } from "react";
import { http } from "../api/http";
import type { ActivityResponse, Difficulty } from "../types/activity";
import { ActivityCard } from "../components/ActivityCard";
import styles from "../style/home.module.css";
import { Header } from "../components/Header";

type LoadState = "idle" | "loading" | "error" | "done";

export default function HomePage() {
  const [state, setState] = useState<LoadState>("idle");
  const [activities, setActivities] = useState<ActivityResponse[]>([]);
  const [query, setQuery] = useState("");
  const [difficulty, setDifficulty] = useState<Difficulty | "All">("All");

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setState("loading");
      try {
        const { data } = await http.get<ActivityResponse[]>("/api/activities/all");
        if (!cancelled) {
          setActivities(data ?? []);
          setState("done");
        }
      } catch {
        if (!cancelled) setState("error");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();

    return activities.filter((a) => {
      const matchesQuery =
        !q ||
        a.title.toLowerCase().includes(q) ||
        a.description.toLowerCase().includes(q) ||
        (a.address?.displayName?.toLowerCase().includes(q) ?? false);

      const matchesDifficulty = difficulty === "All" || a.difficulty === difficulty;

      return matchesQuery && matchesDifficulty;
    });
  }, [activities, query, difficulty]);

  const handleClearFilters = () => {
    setQuery("");
    setDifficulty("All");
  };

  const hasActiveFilters = query.trim() !== "" || difficulty !== "All";

  return (
    <>
    <Header />
    <main className={styles.home}>
      {/* Hero Section */}
      <section className={styles.homeHero}>
        <div className={styles.heroBackground} />
        <div className={styles.heroContent}>
          <h1 className={styles.homeTitle}>
            Find your next <span className={styles.accent}>UnTamed</span> adventure
          </h1>
          <p className={styles.homeSubtitle}>
            Browse curated outdoor experiences posted by expert guides.<br />
            Book, explore, and reconnect with nature.
          </p>

          {/* Search & Filter Bar */}
          <div className={styles.searchContainer}>
            <div className={styles.searchBox}>
              <svg className={styles.searchIcon} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8"/>
                <path d="m21 21-4.35-4.35"/>
              </svg>
              <input
                className={styles.searchInput}  
                placeholder="Search activities, locations, or guides..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              {query && (
                <button className={styles.clearSearch} onClick={() => setQuery("")}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="18" y1="6" x2="6" y2="18"/>
                    <line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                </button>
              )}
            </div>

            <select
              className={styles.difficultySelect}   
              value={difficulty}
              onChange={(e) => setDifficulty(e.target.value as any)}
            >
              <option value="All">All Levels</option>
              <option value="Easy">🟢 Easy</option>
              <option value="Medium">🟡 Medium</option>
              <option value="Hard">🔴 Hard</option>
            </select>

            {hasActiveFilters && (
              <button className={styles.clearFilters} onClick={handleClearFilters}>
                Clear filters
              </button>
            )}
          </div>

          {/* Stats */}
          {state === "done" && (
              <div className={styles.statsBar}>
              <div className={styles.stat}>
                <span className={styles.statNumber}>{activities.length}</span>
                <span className={styles.statLabel}>Total Adventures</span>
              </div>
              <div className={styles.statDivider} />
              <div className={styles.stat}>
                <span className={styles.statNumber}>{filtered.length}</span>
                <span className={styles.statLabel}>Showing</span>
              </div>
              {hasActiveFilters && (
                <>
                  <div className={styles.statDivider} />
                  <div className={styles.stat}>
                    <span className={styles.statIcon}>🔍</span>
                    <span className={styles.statLabel}>Filters active</span>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </section>

      {/* Activities Section */}
      <section className={styles.activitiesSection}>
        <div className={styles.container}>
          {/* Loading State */}
          {state === "loading" && (
            <div className={styles.stateContainer}>
              <div className={styles.loadingSpinner} />
              <p className={styles.stateText}>Loading adventures...</p>
            </div>
          )}

          {/* Error State */}
          {state === "error" && (
            <div className={`${styles.stateContainer} ${styles.stateError}`}>
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10"/>
                <line x1="12" y1="8" x2="12" y2="12"/>
                <line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
              <p className={styles.stateText}>Failed to load activities</p>
              <p className={styles.stateSubtext}>Please check your connection and try again</p>
            </div>
          )}

          {/* Empty State */}
          {state === "done" && filtered.length === 0 && activities.length === 0 && (
            <div className={styles.stateContainer}>
              <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                <polyline points="9 22 9 12 15 12 15 22"/>
              </svg>
              <p className={styles.stateText}>No activities available yet</p>
              <p className={styles.stateSubtext}>Check back soon for new adventures</p>
            </div>
          )}

          {/* No Results State */}
          {state === "done" && filtered.length === 0 && activities.length > 0 && (
            <div className={styles.stateContainer}>
              <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <circle cx="11" cy="11" r="8"/>
                <path d="m21 21-4.35-4.35"/>
              </svg>
              <p className={styles.stateText}>No activities match your filters</p>
              <p className={styles.stateSubtext}>Try adjusting your search or difficulty level</p>
              <button className={styles.btnSecondary} onClick={handleClearFilters}>
                Clear all filters
              </button>
            </div>
          )}

          {/* Activity Grid */}
          {filtered.length > 0 && (
            <>
              <div className={styles.sectionHeader}>
                <h2 className={styles.sectionTitle}>Available Adventures</h2>
                <p className={styles.sectionSubtitle}>
                  {filtered.length} {filtered.length === 1 ? 'experience' : 'experiences'} waiting for you
                </p>
              </div>

              <div className={styles.activityGrid}>
                {filtered.map((activity, index) => (
                  <ActivityCard 
                    key={activity.id} 
                    activity={activity}
                    index={index}
                  />
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
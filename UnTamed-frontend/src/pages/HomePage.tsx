import { useEffect, useMemo, useState } from "react";
import type { PublicTemplateCard, Difficulty } from "../types/activity";
import { ActivityCard } from "../components/ActivityCard";
import styles from "../style/home.module.css";
import { listPublicTemplates } from "../api/activity.api";
import { Header } from "../components/Header";

type LoadState = "idle" | "loading" | "error" | "done";

export default function HomePage() {
  const [state, setState] = useState<LoadState>("idle");
  const [templates, setTemplates] = useState<PublicTemplateCard[]>([]);
  const [query, setQuery] = useState("");
  const [difficulty, setDifficulty] = useState<Difficulty | "All">("All");

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setState("loading");
      try {
        const data = await listPublicTemplates();
        if (cancelled) return;

        setTemplates(data ?? []);
        setState("done");
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

    return templates.filter((t) => {
      const matchesQuery =
        !q ||
        (t.title ?? "").toLowerCase().includes(q) ||
        (t.description ?? "").toLowerCase().includes(q) ||
        (t.tags ?? []).some((x) => (x ?? "").toLowerCase().includes(q));

      const matchesDifficulty = difficulty === "All" || t.difficulty === difficulty;

      return matchesQuery && matchesDifficulty;
    });
  }, [templates, query, difficulty]);

  const handleClearFilters = () => {
    setQuery("");
    setDifficulty("All");
  };

  const hasActiveFilters = query.trim() !== "" || difficulty !== "All";

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
              Browse curated outdoor experiences posted by expert guides.<br />
              Book, explore, and reconnect with nature.
            </p>

            <div className={styles.searchContainer}>
              <div className={styles.searchBox}>
                <svg
                  className={styles.searchIcon}
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <circle cx="11" cy="11" r="8" />
                  <path d="m21 21-4.35-4.35" />
                </svg>

                <input
                  className={styles.searchInput}
                  placeholder="Search experiences or tags..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />

                {query && (
                  <button className={styles.clearSearch} onClick={() => setQuery("")} type="button">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                )}
              </div>

              <select
                className={styles.difficultySelect}
                value={difficulty}
                onChange={(e) => setDifficulty(e.target.value as Difficulty | "All")}
              >
                <option value="All">All Levels</option>
                <option value="EASY">🟢 Easy</option>
                <option value="MEDIUM">🟡 Medium</option>
                <option value="HARD">🔴 Hard</option>
              </select>

              {hasActiveFilters && (
                <button className={styles.clearFilters} onClick={handleClearFilters} type="button">
                  Clear filters
                </button>
              )}
            </div>

            {state === "done" && (
              <div className={styles.statsBar}>
                <div className={styles.stat}>
                  <span className={styles.statNumber}>{templates.length}</span>
                  <span className={styles.statLabel}>Total Experiences</span>
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

            {state === "done" && filtered.length === 0 && templates.length === 0 && (
              <div className={styles.stateContainer}>
                <p className={styles.stateText}>No experiences available yet</p>
                <p className={styles.stateSubtext}>Check back soon for new adventures</p>
              </div>
            )}

            {state === "done" && filtered.length === 0 && templates.length > 0 && (
              <div className={styles.stateContainer}>
                <p className={styles.stateText}>No experiences match your filters</p>
                <p className={styles.stateSubtext}>Try adjusting your search or difficulty level</p>
                <button className={styles.btnSecondary} onClick={handleClearFilters} type="button">
                  Clear all filters
                </button>
              </div>
            )}

            {filtered.length > 0 && (
              <>
                <div className={styles.sectionHeader}>
                  <h2 className={styles.sectionTitle}>Available Experiences</h2>
                  <p className={styles.sectionSubtitle}>
                    {filtered.length} {filtered.length === 1 ? "experience" : "experiences"} waiting for you
                  </p>
                </div>

                <div className={styles.activityGrid}>
                  {filtered.map((t, index) => (
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
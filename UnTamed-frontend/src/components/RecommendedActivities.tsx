import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { getMyRecommendations } from "../api/recommendation.api";
import { listCategories } from "../api/category.api";
import type { RecommendationItem } from "../types/recommendation";
import type { Category } from "../types/category";
import styles from "../style/RecommendedActivities.module.css";

// ─── helpers ────────────────────────────────────────────────────────────────

function formatPrice(price?: number): string | null {
  if (typeof price !== "number") return null;
  return `${price} TND`;
}

// ─── sub-components ──────────────────────────────────────────────────────────

function AIBadge() {
  return (
    <span className={styles.aiBadge} aria-label="AI-powered">
      <svg
        width="13"
        height="13"
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden="true"
        className={styles.aiIcon}
      >
        <path
          d="M12 2L13.09 8.26L19 6L14.74 10.91L21 12L14.74 13.09L19 18L13.09 15.74L12 22L10.91 15.74L5 18L9.26 13.09L3 12L9.26 10.91L5 6L10.91 8.26L12 2Z"
          fill="currentColor"
        />
      </svg>
      AI Picks
    </span>
  );
}

function SectionHeader({ title }: { title: string }) {
  return (
    <div className={styles.header}>
      <div className={styles.headerLeft}>
        <AIBadge />
        <h2 className={styles.heading}>{title}</h2>
        <p className={styles.subheading}>
          Curated just for you based on your interests &amp; activity history
        </p>
      </div>
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className={styles.skeletonCard} aria-hidden="true">
      <div className={styles.skeletonImage} />
      <div className={styles.skeletonBody}>
        <div className={styles.skeletonLineLg} />
        <div className={styles.skeletonLineMd} />
        <div className={styles.skeletonLineSm} />
      </div>
    </div>
  );
}

function RecoCard({
  item,
}: {
  item: RecommendationItem;
}) {
  const avg = Number(item.ratingAverage ?? 0);
  const cnt = Number(item.ratingCount ?? 0);
  const isFree = Number(item.price ?? 0) === 0;
  const sessionCount = item.nextSessionDate ? 1 : 0;

  // difficulty colors matching ActivityCard
  const difficultyStyle = useMemo(() => {
    const d = (item.difficulty ?? "").toUpperCase();
    if (d === "HARD")   return { bg: "#fee2e2", color: "#991b1b", dot: "#ef4444" };
    if (d === "MEDIUM") return { bg: "#fef9c3", color: "#854d0e", dot: "#ca8a04" };
    return                     { bg: "#dcfce7", color: "#166534", dot: "#16a34a" };
  }, [item.difficulty]);

  const difficultyLabel = useMemo(() => {
    const d = (item.difficulty ?? "").toUpperCase();
    if (d === "HARD") return "Hard";
    if (d === "MEDIUM") return "Medium";
    return "Easy";
  }, [item.difficulty]);

  return (
    <Link
      to={`/activities/${item.templateId}`}
      className={styles.card}
      aria-label={item.title}
    >
      {/* image */}
      <div className={styles.imageWrap}>
        {item.coverImageUrl ? (
          <img
            src={item.coverImageUrl}
            alt={item.title}
            className={styles.image}
            loading="lazy"
          />
        ) : (
          <div className={styles.imageFallback}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M21 15l-5-5L5 21M3 3l18 18M10.5 6.5a2 2 0 11-4 0 2 2 0 014 0z"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
        )}

        {/* difficulty badge */}
        {item.difficulty && (
          <span
            className={styles.difficultyChip}
            style={{ background: difficultyStyle.bg, color: difficultyStyle.color }}
          >
            <span style={{
              width: 5, height: 5, borderRadius: "50%",
              background: difficultyStyle.dot, flexShrink: 0,
              display: "inline-block",
            }} />
            {difficultyLabel}
          </span>
        )}
      </div>

      {/* body */}
      <div className={styles.body}>
        <h3 className={styles.cardTitle}>{item.title}</h3>

        {item.description && (
          <p className={styles.description}>{item.description}</p>
        )}

        {sessionCount > 0 && (
          <p className={styles.sessionInfo}>
            {sessionCount} session{sessionCount > 1 ? "s" : ""}
          </p>
        )}

        {/* rating + price row */}
        <div className={styles.meta}>
          <div className={styles.rating}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill={avg > 0 ? "#f59e0b" : "#d1d5db"}>
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
            </svg>
            <span>{avg > 0 ? avg.toFixed(1) : "New"}</span>
            {cnt > 0 && <span className={styles.ratingCount}>({cnt})</span>}
          </div>

          <div className={styles.priceBlock}>
            {isFree ? (
              <span className={styles.priceFree}>Free</span>
            ) : (
              <>
                <span className={styles.priceFrom}>From</span>
                <span className={styles.priceValue}>{item.price} TND</span>
              </>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}

// ─── main component ──────────────────────────────────────────────────────────

type Props = {
  title?: string;
  limit?: number;
};

export default function RecommendedActivities({
  title = "Recommended for you",
  limit = 6,
}: Props) {
  const [items, setItems] = useState<RecommendationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        setLoading(true);
        setError(null);
        const recommendations = await getMyRecommendations(limit);
        if (!active) return;
        setItems(recommendations ?? []);
      } catch (err) {
        console.error("Failed to load recommendations", err);
        if (!active) return;
        setError("Could not load recommendations right now.");
      } finally {
        if (active) setLoading(false);
      }
    }

    load();
    return () => { active = false; };
  }, [limit]);

  return (
    <section className={styles.section}>
      <SectionHeader title={title} />

      {loading && (
        <div className={styles.grid}>
          {Array.from({ length: Math.min(limit, 4) }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      )}

      {!loading && error && (
        <div className={styles.stateBox}>
          <span className={styles.stateIcon}>⚠️</span>
          <p>{error}</p>
        </div>
      )}

      {!loading && !error && items.length === 0 && (
        <div className={styles.stateBox}>
          <span className={styles.stateIcon}>🧭</span>
          <p>
            No recommendations yet — book or review activities and your
            personalised suggestions will appear here.
          </p>
        </div>
      )}

      {!loading && !error && items.length > 0 && (
        <div className={styles.grid}>
          {items.map((item) => (
            <RecoCard key={item.templateId} item={item} />
          ))}
        </div>
      )}
    </section>
  );
}
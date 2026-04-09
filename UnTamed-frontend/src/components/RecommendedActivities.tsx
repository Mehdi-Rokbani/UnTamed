import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { getMyRecommendations } from "../api/recommendation.api";
import { listCategories } from "../api/category.api";
import type { RecommendationItem } from "../types/recommendation";
import type { Category } from "../types/category";
import styles from "../style/RecommendedActivities.module.css";

// ─── helpers ────────────────────────────────────────────────────────────────

function formatDate(value?: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function formatPrice(price?: number): string | null {
  if (typeof price !== "number") return null;
  return `${price} TND`;
}

function formatRating(avg?: number, count?: number): string {
  const safeAvg = typeof avg === "number" ? avg.toFixed(1) : "0.0";
  const safeCount = typeof count === "number" ? count : 0;
  return `${safeAvg} (${safeCount})`;
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
        <div className={styles.skeletonPill} />
        <div className={styles.skeletonLineLg} />
        <div className={styles.skeletonLineMd} />
        <div className={styles.skeletonLineSm} />
      </div>
    </div>
  );
}

function ActivityCard({
  item,
  categoryMap,
}: {
  item: RecommendationItem;
  categoryMap: Map<string, string>;
}) {
  const categoryNames = (item.categoryIds ?? [])
    .map((id) => categoryMap.get(id))
    .filter((n): n is string => Boolean(n))
    .slice(0, 2);

  const formattedDate = formatDate(item.nextSessionDate);
  const formattedPrice = formatPrice(item.price);

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
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M21 15l-5-5L5 21M3 3l18 18M10.5 6.5a2 2 0 11-4 0 2 2 0 014 0z"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <span>No image</span>
          </div>
        )}

        {/* floating price chip */}
        {formattedPrice && (
          <span className={styles.priceChip}>{formattedPrice}</span>
        )}

        {/* difficulty pill */}
        {item.difficulty && (
          <span className={styles.difficultyChip}>{item.difficulty}</span>
        )}
      </div>

      {/* body */}
      <div className={styles.body}>
        <h3 className={styles.cardTitle}>{item.title}</h3>

        {item.description && (
          <p className={styles.description}>{item.description}</p>
        )}

        {categoryNames.length > 0 && (
          <div className={styles.tags}>
            {categoryNames.map((name) => (
              <span key={name} className={styles.tag}>
                {name}
              </span>
            ))}
          </div>
        )}

        <div className={styles.meta}>
          <span className={styles.rating}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
            </svg>
            {formatRating(item.ratingAverage, item.ratingCount)}
          </span>

          {formattedDate && (
            <span className={styles.nextDate}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <rect x="3" y="4" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="1.8" />
                <path d="M16 2v4M8 2v4M3 10h18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
              {formattedDate}
            </span>
          )}
        </div>

        {(item.reasons?.length ?? 0) > 0 && (
          <ul className={styles.reasons}>
            {item.reasons.slice(0, 2).map((reason, i) => (
              <li key={`${item.templateId}-reason-${i}`} className={styles.reason}>
                <span className={styles.reasonDot} aria-hidden="true" />
                {reason}
              </li>
            ))}
          </ul>
        )}
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
  title = "Intelligent Picks for You",
  limit = 6,
}: Props) {
  const [items, setItems] = useState<RecommendationItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const categoryMap = useMemo(
    () => new Map(categories.map((c) => [c.id, c.name])),
    [categories]
  );

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        setLoading(true);
        setError(null);

        const [recommendations, categoryData] = await Promise.all([
          getMyRecommendations(limit),
          listCategories(),
        ]);

        if (!active) return;
        setItems(recommendations ?? []);
        setCategories(categoryData ?? []);
      } catch (err) {
        console.error("Failed to load recommendations", err);
        if (!active) return;
        setError("Could not load recommendations right now. Please try again.");
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
          {Array.from({ length: Math.min(limit, 3) }).map((_, i) => (
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
            <ActivityCard
              key={item.templateId}
              item={item}
              categoryMap={categoryMap}
            />
          ))}
        </div>
      )}
    </section>
  );
}
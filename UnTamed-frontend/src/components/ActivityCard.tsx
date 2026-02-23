// src/components/ActivityCard.tsx
import { Link } from "react-router-dom";
import type { ActivityResponse } from "../types/activity";
import styles from "../style/activitycard.module.css";

function formatDate(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;

  const options: Intl.DateTimeFormatOptions = {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  };

  return d.toLocaleDateString("en-US", options);
}

function getDifficultyColor(difficulty: string) {
  if (!difficulty) return "easy";
  switch (difficulty.toLowerCase()) {
    case "easy":
      return "easy";
    case "medium":
      return "medium";
    case "hard":
      return "hard";
    default:
      return "easy";
  }
}

function getDifficultyIcon(difficulty: string) {
  if (!difficulty) return "🟢";
  switch (difficulty.toLowerCase()) {
    case "easy":
      return "🟢";
    case "medium":
      return "🟡";
    case "hard":
      return "🔴";
    default:
      return "🟢";
  }
}

// Generate a consistent gradient based on activity ID (fallback when no cover image)
function getGradientForId(id: string): string {
  const gradients = [
    "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
    "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)",
    "linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)",
    "linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)",
    "linear-gradient(135deg, #fa709a 0%, #fee140 100%)",
    "linear-gradient(135deg, #30cfd0 0%, #330867 100%)",
  ];

  const hash = id.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return gradients[hash % gradients.length];
}

interface ActivityCardProps {
  activity: ActivityResponse;
  index?: number;
}

export function ActivityCard({ activity, index = 0 }: ActivityCardProps) {
  const { id, title, description, difficulty, price, date, capacity, address, images } = activity;

  // pick cover -> else first by order -> else null
  const cover =
    images?.find((img) => img.cover) ??
    (images ? [...images].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))[0] : undefined) ??
    null;

  const backgroundStyle: React.CSSProperties = cover?.url
    ? {
        backgroundImage: `url(${cover.url})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
      }
    : {
        backgroundImage: getGradientForId(id),
      };

  return (
    <article className={styles.activityCard} style={{ animationDelay: `${index * 0.1}s` }}>
      {/* Image/Thumbnail */}
      <div className={styles.activityCardImage} style={backgroundStyle}>
        {/* dark gradient overlay for readability */}
        <div className={styles.imageOverlay} />

        {/* If no cover image, show your icon as before */}
        {!cover?.url && (
          <div className={styles.fallbackIcon}>
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
              <polyline points="9 22 9 12 15 12 15 22" />
            </svg>
          </div>
        )}

        {/* Badges on image */}
        <div className={styles.activityCardBadges}>
          <span className={`badge badge--difficulty badge--${getDifficultyColor(difficulty)}`}>
            {getDifficultyIcon(difficulty)} {difficulty}
          </span>

          <span className={`${styles.badge} ${styles.badgePrice}`}>{price === 0 ? "🎁 Free" : `💰 ${price} TND`}</span>
        </div>
      </div>

      {/* Content */}
      <div className={styles.activityCardContent}>
        <h3 className={styles.activityCardTitle}>{title}</h3>

        <p className={styles.activityCardDescription}>
          {description?.length > 100 ? description.slice(0, 100) + "..." : description}
        </p>

        {/* Meta Info */}
        <div className={styles.activityCardMeta}>
          {address?.displayName && (
            <div className={styles.metaItem}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                <circle cx="12" cy="10" r="3" />
              </svg>
              <span>{address.displayName}</span>
            </div>
          )}

          <div className={styles.metaItem}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
              <line x1="16" y1="2" x2="16" y2="6" />
              <line x1="8" y1="2" x2="8" y2="6" />
              <line x1="3" y1="10" x2="21" y2="10" />
            </svg>
            <span>{formatDate(date)}</span>
          </div>

          <div className={styles.metaItem}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
            <span>{capacity} spots</span>
          </div>
        </div>

        {/* Action */}
        <Link to={`/activities/${id}`} className={styles.activityCardButton}>
          View Details
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M5 12h14M12 5l7 7-7 7" />
          </svg>
        </Link>
      </div>
    </article>
  );
}

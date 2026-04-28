import { Link } from "react-router-dom";
import type { CSSProperties, MouseEvent } from "react";
import type { PublicTemplateCard } from "../types/activity";
import styles from "../style/activitycard.module.css";

function difficultyKey(d?: string | null) {
  const x = (d ?? "").toUpperCase();
  if (x === "EASY" || x === "MEDIUM" || x === "HARD") return x;
  return "EASY";
}

function getGradientForId(id: string): string {
  const gradients = [
    "linear-gradient(160deg, #1a4d2e 0%, #4d7c3f 100%)",
    "linear-gradient(160deg, #2d5f3e 0%, #ff8c42 100%)",
    "linear-gradient(160deg, #1a3a4d 0%, #2d7c6e 100%)",
    "linear-gradient(160deg, #4d2e1a 0%, #c4713a 100%)",
    "linear-gradient(160deg, #2e1a4d 0%, #7c3f7a 100%)",
    "linear-gradient(160deg, #1a4d3e 0%, #38a87a 100%)",
  ];

  const hash = id
    .split("")
    .reduce((acc, char) => acc + char.charCodeAt(0), 0);

  return gradients[hash % gradients.length];
}

const DIFFICULTY_CONFIG = {
  EASY: { dot: "#16a34a", bg: "#dcfce7", text: "#166534", label: "Easy" },
  MEDIUM: { dot: "#ca8a04", bg: "#fef9c3", text: "#854d0e", label: "Medium" },
  HARD: { dot: "#ef4444", bg: "#fee2e2", text: "#991b1b", label: "Hard" },
} as const;

type ActivityCardData = PublicTemplateCard & {
  nextSessionDate?: string | null;
  soldOut?: boolean;
};

interface ActivityCardProps {
  activity: ActivityCardData;
  index?: number;
}

export function ActivityCard({ activity, index = 0 }: ActivityCardProps) {
  const {
    id,
    title,
    description,
    difficulty,
    price,
    coverImageUrl,
    rating,
    nextSession,
    upcomingSessionsCount,
  } = activity;

  const backgroundStyle: CSSProperties = coverImageUrl
    ? {
        backgroundImage: `url(${coverImageUrl})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
      }
    : { backgroundImage: getGradientForId(id) };

  const avg = Number(rating?.average ?? 0);
  const cnt = Number(rating?.count ?? 0);

  const dk = difficultyKey(difficulty);
  const diff = DIFFICULTY_CONFIG[dk];

  const isFree = Number(price ?? 0) === 0;

  const hasRealCapacity =
    typeof nextSession?.capacity === "number" && nextSession.capacity > 0;

  const spotsLeft =
    hasRealCapacity && typeof nextSession?.bookedCount === "number"
      ? Math.max(0, nextSession.capacity - nextSession.bookedCount)
      : null;

  // ✅ Important fix:
  // Do NOT mark sold out when capacity is missing or 0.
  const isSoldOut =
    typeof activity.soldOut === "boolean"
      ? activity.soldOut
      : spotsLeft !== null
        ? spotsLeft === 0
        : false;

  const isLowStock = spotsLeft !== null && spotsLeft <= 3 && spotsLeft > 0;

  const sessionCount =
    typeof upcomingSessionsCount === "number"
      ? upcomingSessionsCount
      : activity.nextSessionDate || nextSession
        ? 1
        : 0;

  const handleWishlistClick = (e: MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  return (
    <Link
      to={`/activities/${id}`}
      className={styles.activityCard}
      style={{ animationDelay: `${index * 0.06}s` }}
      aria-label={`View details for ${title}`}
    >
      <div className={styles.activityCardImage} style={backgroundStyle}>
        {!coverImageUrl && (
          <div className={styles.fallbackIcon}>
            <svg
              width="32"
              height="32"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            >
              <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3m8 0h3a2 2 0 0 0 2-2v-3" />
            </svg>
          </div>
        )}

        <button
          className={styles.wishlistBtn}
          aria-label="Save to wishlist"
          onClick={handleWishlistClick}
          type="button"
        >
          <svg
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
          >
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
          </svg>
        </button>

        <span
          className={styles.difficultyBadge}
          style={{ background: diff.bg, color: diff.text }}
        >
          <span
            className={styles.difficultyDot}
            style={{ background: diff.dot }}
          />
          {diff.label}
        </span>
      </div>

      <div className={styles.activityCardContent}>
        <h3 className={styles.activityCardTitle}>{title}</h3>

        {description && (
          <p className={styles.activityCardDescription}>{description}</p>
        )}

        {sessionCount > 0 && (
          <p className={styles.sessionInfo}>
            {sessionCount} session{sessionCount > 1 ? "s" : ""}
          </p>
        )}

        <div className={styles.cardFooter}>
          <div className={styles.ratingBlock}>
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill={avg > 0 ? "#f59e0b" : "#d1d5db"}
            >
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
            </svg>

            <span className={styles.ratingAvg}>
              {avg > 0 ? avg.toFixed(1) : "New"}
            </span>

            {cnt > 0 && <span className={styles.ratingCount}>({cnt})</span>}

            {isSoldOut && (
              <span className={styles.badgeSoldOut}>Sold out</span>
            )}

            {isLowStock && !isSoldOut && (
              <span className={styles.badgeLowStock}>⚡ {spotsLeft} left</span>
            )}
          </div>

          <div className={styles.priceBlock}>
            {isFree ? (
              <span className={styles.priceFree}>Free</span>
            ) : (
              <>
                <span className={styles.priceFrom}>From</span>
                <span className={styles.priceValue}>{price} TND</span>
              </>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}
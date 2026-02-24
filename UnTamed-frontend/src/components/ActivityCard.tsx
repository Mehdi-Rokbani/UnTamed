import { Link } from "react-router-dom";
import type { PublicTemplateCard } from "../types/activity";
import styles from "../style/activitycard.module.css";

function formatDate(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function difficultyKey(d: string) {
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
  const hash = id.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return gradients[hash % gradients.length];
}

function renderStars(avg: number) {
  return Array.from({ length: 5 }, (_, i) => {
    const filled = i < Math.floor(avg);
    const partial = !filled && i < avg;
    return (
      <span key={i} className={`${styles.star} ${filled ? styles.starFilled : partial ? styles.starPartial : styles.starEmpty}`}>
        ★
      </span>
    );
  });
}

interface ActivityCardProps {
  activity: PublicTemplateCard;
  index?: number;
}

export function ActivityCard({ activity, index = 0 }: ActivityCardProps) {
  const { id, title, description, difficulty, price, coverImageUrl, rating, nextSession, tags, upcomingSessionsCount } = activity;

  const backgroundStyle: React.CSSProperties = coverImageUrl
    ? { backgroundImage: `url(${coverImageUrl})`, backgroundSize: "cover", backgroundPosition: "center" }
    : { backgroundImage: getGradientForId(id) };

  const avg = Number(rating?.average ?? 0);
  const cnt = Number(rating?.count ?? 0);
  const dk = difficultyKey(difficulty);

  const spotsLeft =
    typeof nextSession?.capacity === "number" && typeof nextSession?.bookedCount === "number"
      ? Math.max(0, nextSession.capacity - nextSession.bookedCount)
      : null;

  const isFree = Number(price ?? 0) === 0;
  const isLowStock = spotsLeft !== null && spotsLeft <= 3 && spotsLeft > 0;
  const isSoldOut = spotsLeft === 0;

  return (
    <Link
      to={`/activities/${id}`}
      className={styles.activityCard}
      style={{ animationDelay: `${index * 0.07}s` }}
      aria-label={`View details for ${title}`}
    >
      {/* ── IMAGE ZONE ── */}
      <div className={styles.activityCardImage} style={backgroundStyle}>
        <div className={styles.imageGradient} />

        {!coverImageUrl && (
          <div className={styles.fallbackIcon}>
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
              <polyline points="9 22 9 12 15 12 15 22" />
            </svg>
          </div>
        )}

        {/* Top-left badges */}
        <div className={styles.topBadges}>
          {upcomingSessionsCount != null && upcomingSessionsCount > 0 && (
            <span className={styles.badgeTopPick}>
              🗓 {upcomingSessionsCount} session{upcomingSessionsCount > 1 ? "s" : ""}
            </span>
          )}
          <span className={`${styles.badgeDifficulty} ${styles[`diff${dk}`]}`}>
            {dk === "EASY" ? "🟢" : dk === "MEDIUM" ? "🟡" : "🔴"} {dk}
          </span>
        </div>

        {/* Wishlist button (purely visual, UX hint) */}
        <button
          className={styles.wishlistBtn}
          aria-label="Save to wishlist"
          onClick={(e) => e.preventDefault()}
          type="button"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
          </svg>
        </button>

        {/* Bottom overlay: price */}
        <div className={styles.imagePriceBar}>
          <span className={styles.priceLabel}>
            {isFree ? "Free" : "From"}
          </span>
          <span className={styles.priceValue}>
            {isFree ? "" : `${price} TND`}
          </span>
        </div>
      </div>

      {/* ── CONTENT ZONE ── */}
      <div className={styles.activityCardContent}>

        {/* Title */}
        <h3 className={styles.activityCardTitle}>{title}</h3>

        {/* Tags row */}
        {tags?.length > 0 && (
          <div className={styles.tagsRow}>
            {tags.slice(0, 3).map((tag) => (
              <span key={tag} className={styles.tag}>{tag}</span>
            ))}
          </div>
        )}

        {/* Description */}
        <p className={styles.activityCardDescription}>
          {description?.length > 90 ? description.slice(0, 90) + "…" : description}
        </p>

        {/* Divider */}
        <div className={styles.divider} />

        {/* Bottom meta: rating + session + stock */}
        <div className={styles.cardFooter}>
          <div className={styles.ratingBlock}>
            <div className={styles.stars}>{renderStars(avg)}</div>
            <span className={styles.ratingAvg}>{avg.toFixed(1)}</span>
            <span className={styles.ratingCount}>({cnt})</span>
          </div>

          <div className={styles.footerRight}>
            {isSoldOut ? (
              <span className={styles.badgeSoldOut}>Sold out</span>
            ) : isLowStock ? (
              <span className={styles.badgeLowStock}>⚡ {spotsLeft} left</span>
            ) : nextSession?.date ? (
              <span className={styles.nextDate}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <rect x="3" y="4" width="18" height="18" rx="2" />
                  <line x1="16" y1="2" x2="16" y2="6" />
                  <line x1="8" y1="2" x2="8" y2="6" />
                  <line x1="3" y1="10" x2="21" y2="10" />
                </svg>
                {formatDate(nextSession.date)}
              </span>
            ) : null}
          </div>
        </div>
      </div>
    </Link>
  );
}
import type { EnrichedReview } from "./ActivityTab";
import styles from "../style/ReviewCard.module.css";

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(iso?: string) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function renderStars(rating: number) {
  return Array.from({ length: 5 }, (_, i) => (
    <span key={i} className={i < rating ? styles.starFilled : styles.starEmpty}>
      ★
    </span>
  ));
}

// ── Component ─────────────────────────────────────────────────────────────────

type Props = {
  review: EnrichedReview;
  index?: number;
};

export function ReviewCard({ review, index = 0 }: Props) {
  return (
    <article
      className={styles.card}
      style={{ animationDelay: `${index * 60}ms` }}
    >
      {/* ── Image banner ──────────────────────────────────────────── */}
      <div className={styles.imageWrapper}>
        {review.coverImageUrl ? (
          <img
            src={review.coverImageUrl}
            alt={review.activityTitle}
            className={styles.coverImage}
            loading="lazy"
          />
        ) : (
          <div className={styles.coverFallback}>
            <svg
              className={styles.fallbackIcon}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.2}
                d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
              />
            </svg>
          </div>
        )}

        <div className={styles.imageOverlay} />

        {/* Rating badge */}
        <div className={styles.ratingBadge}>
          <span className={styles.ratingValue}>{review.rating}.0</span>
          <div className={styles.ratingStars}>{renderStars(review.rating)}</div>
        </div>
      </div>

      {/* ── Card body ─────────────────────────────────────────────── */}
      <div className={styles.body}>
        <div className={styles.typePill}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
            />
          </svg>
          Review
        </div>

        <div className={styles.topRow}>
          <h3 className={styles.title}>{review.activityTitle}</h3>
          {review.createdAt && (
            <span className={styles.date}>{formatDate(review.createdAt)}</span>
          )}
        </div>

        {review.governorate && (
          <div className={styles.location}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
              />
            </svg>
            {review.governorate}
          </div>
        )}

        <p className={styles.comment}>{review.comment}</p>

        <a
          href={`/activities/${review.activityTemplateId}`}
          className={styles.viewLink}
        >
          View activity
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 5l7 7-7 7"
            />
          </svg>
        </a>
      </div>
    </article>
  );
}
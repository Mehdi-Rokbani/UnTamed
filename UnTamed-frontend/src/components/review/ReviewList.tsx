import { useEffect, useState } from "react";
import type { Review } from "../../types/review";
import * as ReviewApi from "../../api/review.api";
import styles from "../../style/reviews.module.css";
import ReviewCard from "./ReviewCard";
import ReviewForm from "./ReviewForm";
import RatingStars from "./RatingStars";

type Props = {
  templateId: string;
  currentUserId?: string | null;
  guideOwnerId?: string | null;
  /** Whether the current user has a completed booking (eligible to review) */
  canReview?: boolean;
  /** Whether the current user already left a review */
  userReviewId?: string | null;
  /** Open parent edit modal for the current user's review */
  onEditMyReview?: () => void;
};

/* ── Skeleton card ── */
function ReviewSkeleton() {
  return (
    <div className={styles.skeletonCard} aria-hidden="true">
      <div className={styles.skeletonHeader}>
        <div className={styles.skeletonCircle} />
        <div className={styles.skeletonLines}>
          <div className={`${styles.skeletonLine} ${styles.skeletonLineShort}`} />
          <div className={`${styles.skeletonLine} ${styles.skeletonLineTiny}`} />
        </div>
      </div>
      <div className={`${styles.skeletonLine} ${styles.skeletonLineStars}`} />
      <div className={`${styles.skeletonLine} ${styles.skeletonLineFull}`} />
      <div className={`${styles.skeletonLine} ${styles.skeletonLineMed}`} />
    </div>
  );
}

/* ── Ratings summary ── */
function ReviewSummary({ reviews }: { reviews: Review[] }) {
  if (reviews.length === 0) return null;

  const average = reviews.reduce((s, r) => s + r.rating, 0) / reviews.length;
  const counts = [5, 4, 3, 2, 1].map((star) => ({
    star,
    count: reviews.filter((r) => r.rating === star).length,
  }));

  return (
    <div className={styles.summaryBox}>
      <div className={styles.summaryLeft}>
        <span className={styles.summaryAverage}>{average.toFixed(1)}</span>
        <RatingStars value={Math.round(average)} readonly size="md" />
        <span className={styles.summaryCount}>
          {reviews.length} {reviews.length === 1 ? "review" : "reviews"}
        </span>
      </div>

      <div className={styles.summaryRight}>
        {counts.map(({ star, count }) => {
          const pct = Math.round((count / reviews.length) * 100);

          return (
            <div key={star} className={styles.distRow}>
              <span className={styles.distLabel}>{star}</span>
              <svg
                width="11"
                height="11"
                viewBox="0 0 24 24"
                aria-hidden="true"
                className={styles.distStarIcon}
              >
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
              </svg>
              <div
                className={styles.distBar}
                role="progressbar"
                aria-valuenow={pct}
                aria-valuemin={0}
                aria-valuemax={100}
              >
                <div className={styles.distFill} style={{ width: `${pct}%` }} />
              </div>
              <span className={styles.distCount}>{count}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── Empty state ── */
function EmptyReviews({
  canReview,
  onWrite,
}: {
  canReview?: boolean;
  onWrite?: () => void;
}) {
  return (
    <div className={styles.emptyState} role="status">
      <div className={styles.emptyIcon} aria-hidden="true">
        <svg
          width="36"
          height="36"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.3"
          strokeLinecap="round"
        >
          <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
        </svg>
      </div>

      <p className={styles.emptyTitle}>No reviews yet</p>
      <p className={styles.emptySubtitle}>
        {canReview
          ? "Be the first to share your experience."
          : "Reviews from verified bookings will appear here."}
      </p>

      {canReview && onWrite && (
        <button
          type="button"
          className={styles.btnPrimary}
          onClick={onWrite}
          style={{ marginTop: 8 }}
        >
          Write the first review
        </button>
      )}
    </div>
  );
}

/* ── Error state ── */
function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div className={styles.errorState} role="alert">
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="12" />
        <line x1="12" y1="16" x2="12.01" y2="16" />
      </svg>

      <span>{message}</span>

      {onRetry && (
        <button type="button" className={styles.retryBtn} onClick={onRetry}>
          Try again
        </button>
      )}
    </div>
  );
}

export default function ReviewList({
  templateId,
  currentUserId,
  guideOwnerId,
  canReview = false,
  userReviewId,
  onEditMyReview,
}: Props) {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [visibleCount, setVisibleCount] = useState(5);
  const [showForm, setShowForm] = useState(false);

  const hasReviewed = !!userReviewId;
  const isGuide = !!currentUserId && currentUserId === guideOwnerId;

  async function load() {
    try {
      setLoading(true);
      setError("");
      const data = await ReviewApi.listTemplateReviews(templateId);
      setReviews(data);
    } catch (err: any) {
      setError(err?.response?.data?.message || "Failed to load reviews.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;

    async function run() {
      try {
        setLoading(true);
        setError("");
        const data = await ReviewApi.listTemplateReviews(templateId);
        if (!cancelled) setReviews(data);
        if (!cancelled) setLoading(false);
      } catch (err: any) {
        if (!cancelled) {
          setError(err?.response?.data?.message || "Failed to load reviews.");
          setLoading(false);
        }
      }
    }

    run();

    return () => {
      cancelled = true;
    };
  }, [templateId]);

  const SectionHeader = () => (
    <div className={styles.sectionHeader}>
      <div>
        <h2 className={styles.sectionTitle}>Reviews</h2>
        {!loading && reviews.length > 0 && (
          <span className={styles.sectionCount}>{reviews.length}</span>
        )}
      </div>

      {!isGuide && (
        <>
          {hasReviewed ? (
            onEditMyReview ? (
              <button
                type="button"
                className={styles.reviewedPill}
                onClick={onEditMyReview}
              >
                <svg
                  width="11"
                  height="11"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeLinecap="round"
                  aria-hidden="true"
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                Edit your review
              </button>
            ) : (
              <span className={styles.reviewedPill}>
                <svg
                  width="11"
                  height="11"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeLinecap="round"
                  aria-hidden="true"
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                You reviewed this
              </span>
            )
          ) : canReview ? (
            <button
              type="button"
              className={`${styles.btnPrimary} ${showForm ? styles.btnActive : ""}`}
              onClick={() => setShowForm((v) => !v)}
              aria-expanded={showForm}
            >
              {showForm ? (
                "Cancel"
              ) : (
                <>
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    aria-hidden="true"
                  >
                    <line x1="12" y1="5" x2="12" y2="19" />
                    <line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                  Write a review
                </>
              )}
            </button>
          ) : (
            <span className={styles.eligibilityHint}>
              Complete a booking to leave a review
            </span>
          )}
        </>
      )}
    </div>
  );

  const InlineForm = () =>
    showForm ? (
      <div className={styles.inlineFormWrapper}>
        <ReviewForm
          onCancel={() => setShowForm(false)}
          onSubmit={async () => {
            setShowForm(false);
            await load();
          }}
          confirmDiscard
        />
      </div>
    ) : null;

  if (loading) {
    return (
      <section className={styles.reviewSection} aria-label="Reviews">
        <SectionHeader />
        <div className={styles.skeletonSummary} aria-hidden="true">
          <div className={`${styles.skeletonLine} ${styles.skeletonLineBig}`} />
          <div className={styles.skeletonBars}>
            {[90, 60, 35, 15, 8].map((w, i) => (
              <div key={i} className={styles.skeletonBar} style={{ width: `${w}%` }} />
            ))}
          </div>
        </div>
        <div className={styles.reviewList}>
          {[1, 2, 3].map((i) => (
            <ReviewSkeleton key={i} />
          ))}
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section className={styles.reviewSection} aria-label="Reviews">
        <SectionHeader />
        <ErrorState message={error} onRetry={load} />
      </section>
    );
  }

  return (
    <section className={styles.reviewSection} aria-label="Reviews">
      <SectionHeader />
      <InlineForm />

      {reviews.length === 0 ? (
        <EmptyReviews
          canReview={canReview && !hasReviewed}
          onWrite={() => setShowForm(true)}
        />
      ) : (
        <>
          <ReviewSummary reviews={reviews} />

          <div
            className={styles.reviewList}
            role="list"
            aria-label="Customer reviews"
          >
            {reviews.slice(0, visibleCount).map((review) => (
              <ReviewCard
                key={review.id}
                review={review}
                currentUserId={currentUserId}
                guideOwnerId={guideOwnerId}
                onReviewUpdated={(updated) =>
                  setReviews((prev) =>
                    prev.map((r) => (r.id === updated.id ? updated : r))
                  )
                }
              />
            ))}
          </div>

          {visibleCount < reviews.length && (
            <button
              className={styles.loadMoreBtn}
              onClick={() => setVisibleCount((v) => v + 5)}
              type="button"
            >
              Show {Math.min(5, reviews.length - visibleCount)} more reviews
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                aria-hidden="true"
              >
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>
          )}
        </>
      )}
    </section>
  );
}
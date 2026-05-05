import { Link } from "react-router-dom";
import type { ProfileReview } from "../api/user.api";
import type { PaginatedResponse } from "../types/pagination";
import styles from "../style/ReviewTab.module.css";

type ReviewTabProps = {
  reviews: PaginatedResponse<ProfileReview> | null;
  loading?: boolean;
  loadingMore?: boolean;
  error?: string | null;
  onLoadMore?: () => void;
};

function formatDate(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function Rating({ value }: { value: number }) {
  return (
    <span className={styles.rating} aria-label={`${value} out of 5 stars`}>
      {Array.from({ length: 5 }).map((_, index) => (
        <i key={index} className={index < value ? styles.starOn : ""}>
          *
        </i>
      ))}
      <strong>{value}.0</strong>
    </span>
  );
}

function SkeletonList() {
  return (
    <div className={styles.list} aria-hidden="true">
      {Array.from({ length: 3 }).map((_, index) => (
        <div key={index} className={styles.skeletonRow}>
          <span />
          <div>
            <i />
            <i />
            <i />
          </div>
        </div>
      ))}
    </div>
  );
}

function EmptyState() {
  return (
    <div className={styles.emptyState}>
      <div className={styles.emptyIcon}>*</div>
      <h3>You have not written any reviews yet.</h3>
      <p>Share your experience after your next adventure.</p>
    </div>
  );
}

export function ReviewTab({
  reviews,
  loading = false,
  loadingMore = false,
  error = null,
  onLoadMore,
}: ReviewTabProps) {
  const reviewItems = [...(reviews?.content ?? [])].sort((a, b) => {
    const da = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const db = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return db - da;
  });

  if (loading) return <SkeletonList />;
  if (error) return <div className={styles.errorState}>{error}</div>;
  if (reviewItems.length === 0) return <EmptyState />;

  return (
    <div className={styles.wrapper}>
      <div className={styles.feedHeader}>
        <span>{reviewItems.length} of {reviews?.totalElements ?? reviewItems.length} reviews written</span>
      </div>

      <div className={styles.list}>
        {reviewItems.map((review) => (
          <article key={review.reviewId} className={styles.reviewRow}>
            <div className={styles.reviewImage}>
              {review.activityImageUrl ? (
                <img src={review.activityImageUrl} alt={review.activityTitle} loading="lazy" />
              ) : (
                <span>*</span>
              )}
            </div>
            <div className={styles.reviewBody}>
              <div className={styles.reviewTop}>
                <h3>{review.activityTitle || "Adventure"}</h3>
                <span>{formatDate(review.createdAt)}</span>
              </div>
              <Rating value={review.rating} />
              <p>{review.comment}</p>
              <Link to={`/activities/${review.templateId}`}>View activity</Link>
            </div>
          </article>
        ))}
      </div>

      {reviews && !reviews.last && onLoadMore && (
        <div className={styles.loadMoreWrap}>
          <button type="button" onClick={onLoadMore} disabled={loadingMore}>
            {loadingMore ? "Loading reviews..." : "Load more reviews"}
          </button>
        </div>
      )}
    </div>
  );
}

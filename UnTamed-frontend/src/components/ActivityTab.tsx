import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import type { ProfileCompletedTrip, ProfileReview } from "../api/user.api";
import type { PaginatedResponse } from "../types/pagination";
import styles from "../style/ActivityTab.module.css";

export type EnrichedTrip = {
  kind: "trip";
  bookingId: string;
  sessionId: string;
  numberOfPeople: number;
  date: string;
  location: string;
  title: string;
  coverImageUrl?: string;
  activitySlug?: string;
};

export type EnrichedReview = {
  kind: "review";
  id: string;
  rating: number;
  comment: string;
  createdAt?: string;
  activityTemplateId: string;
  activityTitle: string;
  coverImageUrl?: string;
  governorate?: string;
};

type ActivityItem = EnrichedTrip | EnrichedReview;
type ActivityFilter = "all" | "trips" | "reviews";

type ActivityTabProps = {
  trips: PaginatedResponse<ProfileCompletedTrip> | null;
  reviews: PaginatedResponse<ProfileReview> | null;
  loading?: boolean;
  error?: string | null;
  loadingMoreTrips?: boolean;
  loadingMoreReviews?: boolean;
  onLoadMoreTrips?: () => void;
  onLoadMoreReviews?: () => void;
};

function Icon({ name }: { name: "mountain" | "star" | "compass" | "chevron" }) {
  const paths = {
    mountain: <path d="m3 19 6-10 4 6 3-4 5 8H3Z" />,
    star: <path d="m12 2 2.9 6 6.6.9-4.8 4.6 1.1 6.5-5.8-3.1L6.2 20l1.1-6.5L2.5 8.9 9.1 8 12 2Z" />,
    compass: <path d="m16.2 7.8-2.1 6.3-6.3 2.1 2.1-6.3 6.3-2.1ZM12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Z" />,
    chevron: <path d="m9 18 6-6-6-6" />,
  };

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      {paths[name]}
    </svg>
  );
}

function formatDate(value?: string) {
  if (!value) return "Date unavailable";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Date unavailable";
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function toTrip(trip: ProfileCompletedTrip): EnrichedTrip {
  return {
    kind: "trip",
    bookingId: trip.bookingId,
    sessionId: trip.sessionId,
    numberOfPeople: trip.numberOfPeople,
    date: trip.sessionStartAt ?? "",
    location: trip.addressDisplayName || trip.governorate || "Location TBD",
    title: trip.activityTitle || "Adventure",
    coverImageUrl: trip.activityImageUrl ?? undefined,
    activitySlug: trip.templateId ?? undefined,
  };
}

function toReview(review: ProfileReview): EnrichedReview {
  return {
    kind: "review",
    id: review.reviewId,
    rating: review.rating,
    comment: review.comment,
    createdAt: review.createdAt ?? undefined,
    activityTemplateId: review.templateId,
    activityTitle: review.activityTitle || "Adventure",
    coverImageUrl: review.activityImageUrl ?? undefined,
    governorate: review.governorate ?? undefined,
  };
}

function Rating({ value }: { value: number }) {
  return (
    <span className={styles.rating} aria-label={`${value} out of 5 stars`}>
      {Array.from({ length: 5 }).map((_, index) => (
        <i key={index} className={index < value ? styles.starOn : ""}>
          *
        </i>
      ))}
    </span>
  );
}

function FeedImage({ src, alt }: { src?: string; alt: string }) {
  return (
    <div className={styles.feedImage}>
      {src ? <img src={src} alt={alt} loading="lazy" /> : <Icon name="mountain" />}
    </div>
  );
}

function TripFeedCard({ trip }: { trip: EnrichedTrip }) {
  return (
    <article className={styles.feedCard}>
      <FeedImage src={trip.coverImageUrl} alt={trip.title} />
      <div className={styles.feedBody}>
        <div className={styles.feedTopline}>
          <span className={styles.statusPill}>Completed</span>
          <span>{formatDate(trip.date)}</span>
        </div>
        <h3>{trip.title}</h3>
        <p>{trip.location}</p>
        <div className={styles.feedMeta}>
          <span>{trip.numberOfPeople} {trip.numberOfPeople === 1 ? "traveller" : "travellers"}</span>
          {trip.activitySlug && (
            <Link to={`/activities/${trip.activitySlug}`} className={styles.feedLink}>
              View activity <Icon name="chevron" />
            </Link>
          )}
        </div>
      </div>
    </article>
  );
}

function ReviewFeedCard({ review }: { review: EnrichedReview }) {
  return (
    <article className={`${styles.feedCard} ${styles.reviewFeedCard}`}>
      <FeedImage src={review.coverImageUrl} alt={review.activityTitle} />
      <div className={styles.feedBody}>
        <div className={styles.feedTopline}>
          <Rating value={review.rating} />
          <span>{formatDate(review.createdAt)}</span>
        </div>
        <h3>{review.activityTitle}</h3>
        <p className={styles.reviewComment}>{review.comment}</p>
        <div className={styles.feedMeta}>
          <span>{review.governorate || "Adventure review"}</span>
          <Link to={`/activities/${review.activityTemplateId}`} className={styles.feedLink}>
            View activity <Icon name="chevron" />
          </Link>
        </div>
      </div>
    </article>
  );
}

function SkeletonList() {
  return (
    <div className={styles.feedList} aria-hidden="true">
      {Array.from({ length: 4 }).map((_, index) => (
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
      <Icon name="compass" />
      <h3>No adventures logged yet.</h3>
      <p>Time to get out there.</p>
      <Link to="/activities">Browse activities</Link>
    </div>
  );
}

export function ActivityTab({
  trips,
  reviews,
  loading = false,
  error = null,
  loadingMoreTrips = false,
  loadingMoreReviews = false,
  onLoadMoreTrips,
  onLoadMoreReviews,
}: ActivityTabProps) {
  const [filter, setFilter] = useState<ActivityFilter>("all");

  const tripItems = useMemo(
    () => (trips?.content ?? []).map(toTrip),
    [trips]
  );
  const reviewItems = useMemo(
    () => (reviews?.content ?? []).map(toReview),
    [reviews]
  );

  const allItems = useMemo((): ActivityItem[] => {
    return [...tripItems, ...reviewItems].sort((a, b) => {
      const dateA = a.kind === "trip" ? a.date : a.createdAt ?? "";
      const dateB = b.kind === "trip" ? b.date : b.createdAt ?? "";
      return new Date(dateB).getTime() - new Date(dateA).getTime();
    });
  }, [tripItems, reviewItems]);

  const filteredItems = filter === "trips" ? tripItems : filter === "reviews" ? reviewItems : allItems;
  const canLoadTrips = Boolean(trips && !trips.last && onLoadMoreTrips);
  const canLoadReviews = Boolean(reviews && !reviews.last && onLoadMoreReviews);

  if (loading) return <SkeletonList />;
  if (error) return <div className={styles.errorState}>{error}</div>;

  return (
    <div className={styles.wrapper}>
      <div className={styles.filterStrip} role="tablist" aria-label="Activity filter">
        {[
          ["all", "All", (trips?.totalElements ?? tripItems.length) + (reviews?.totalElements ?? reviewItems.length)],
          ["trips", "Trips", trips?.totalElements ?? tripItems.length],
          ["reviews", "Reviews", reviews?.totalElements ?? reviewItems.length],
        ].map(([key, label, count]) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={filter === key}
            className={filter === key ? styles.filterActive : ""}
            onClick={() => setFilter(key as ActivityFilter)}
          >
            {label}
            <span>{count}</span>
          </button>
        ))}
      </div>

      {filteredItems.length === 0 ? (
        <EmptyState />
      ) : (
        <div className={styles.feedList}>
          {filteredItems.map((item) =>
            item.kind === "trip" ? (
              <TripFeedCard key={item.bookingId} trip={item} />
            ) : (
              <ReviewFeedCard key={item.id} review={item} />
            )
          )}
        </div>
      )}

      {(filter !== "reviews" && canLoadTrips) || (filter !== "trips" && canLoadReviews) ? (
        <div className={styles.loadMoreWrapper}>
          {filter !== "reviews" && canLoadTrips && (
            <button type="button" onClick={onLoadMoreTrips} disabled={loadingMoreTrips}>
              {loadingMoreTrips ? "Loading adventures..." : "Load more adventures"}
            </button>
          )}
          {filter !== "trips" && canLoadReviews && (
            <button type="button" onClick={onLoadMoreReviews} disabled={loadingMoreReviews}>
              {loadingMoreReviews ? "Loading reviews..." : "Load more reviews"}
            </button>
          )}
        </div>
      ) : null}
    </div>
  );
}

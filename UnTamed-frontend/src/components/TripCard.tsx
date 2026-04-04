import type { EnrichedTrip } from "./ActivityTab";
import styles from "../style/TripCard.module.css";

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(iso: string): {
  day: string;
  month: string;
  year: string;
  full: string;
} {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    return { day: "—", month: "—", year: "—", full: "" };
  }
  return {
    day: d.toLocaleDateString("en-US", { day: "2-digit" }),
    month: d
      .toLocaleDateString("en-US", { month: "short" })
      .toUpperCase(),
    year: d.toLocaleDateString("en-US", { year: "numeric" }),
    full: d.toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    }),
  };
}

const FALLBACK_GRADIENTS = [
  "linear-gradient(135deg, #1a2a1a 0%, #2d5a2d 50%, #4a8f4a 100%)",
  "linear-gradient(135deg, #0d1b2a 0%, #1b3a5c 50%, #2e6da4 100%)",
  "linear-gradient(135deg, #2a1a0a 0%, #6b3a1f 50%, #c47c3e 100%)",
  "linear-gradient(135deg, #1a0a2a 0%, #4a1f6b 50%, #8c3ec4 100%)",
];

function getFallbackGradient(id: string) {
  const index = id.charCodeAt(0) % FALLBACK_GRADIENTS.length;
  return FALLBACK_GRADIENTS[index];
}

// ── Component ─────────────────────────────────────────────────────────────────

type TripCardProps = {
  trip: EnrichedTrip;
  index?: number;
};

export function TripCard({ trip, index = 0 }: TripCardProps) {
  const date = formatDate(trip.date);
  const hasCover = !!trip.coverImageUrl;

  return (
    <article
      className={styles.card}
      style={{ animationDelay: `${index * 60}ms` }}
    >
      {/* ── Image banner ──────────────────────────────────────────── */}
      <div className={styles.imageWrapper}>
        {hasCover ? (
          <img
            src={trip.coverImageUrl}
            alt={trip.title}
            className={styles.coverImage}
            loading="lazy"
          />
        ) : (
          <div
            className={styles.coverFallback}
            style={{ background: getFallbackGradient(trip.bookingId) }}
          >
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
                d="M3 17l4-8 4 6 3-4 4 6H3z"
              />
              <circle cx="17" cy="7" r="2" strokeWidth={1.2} />
            </svg>
          </div>
        )}

        {/* Cinematic overlay */}
        <div className={styles.imageOverlay} />

        {/* Date badge */}
        <div className={styles.dateBadge}>
          <span className={styles.dateDay}>{date.day}</span>
          <span className={styles.dateMonth}>{date.month}</span>
          <span className={styles.dateYear}>{date.year}</span>
        </div>

        {/* Type + status chip */}
        <div className={styles.statusBadge}>
          <span className={styles.statusDot} />
          Completed
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
              d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6-3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"
            />
          </svg>
          Trip
        </div>

        <h3 className={styles.title}>{trip.title}</h3>

        <div className={styles.meta}>
          <div className={styles.metaRow}>
            <svg
              className={styles.metaIcon}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
            >
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
            <span>{trip.location || "Location TBD"}</span>
          </div>

          <div className={styles.metaRow}>
            <svg
              className={styles.metaIcon}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"
              />
            </svg>
            <span>
              {trip.numberOfPeople}{" "}
              {trip.numberOfPeople === 1 ? "participant" : "participants"}
            </span>
          </div>
        </div>

        {trip.activitySlug && (
          <a
            href={`/activities/${trip.activitySlug}`}
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
        )}
      </div>
    </article>
  );
}
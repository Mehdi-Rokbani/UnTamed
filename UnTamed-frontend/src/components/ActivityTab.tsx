import { useEffect, useState, useMemo } from "react";
import * as BookingApi from "../api/booking.api";
import * as ReviewApi from "../api/review.api";
import * as ActivityApi from "../api/activity.api";
import { TripCard } from "./TripCard";
import { ReviewCard } from "./ReviewCard";
import styles from "../style/ActivityTab.module.css";

// ── Types ─────────────────────────────────────────────────────────────────────

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

const PAGE_SIZE = 6;

// ── Data helpers ──────────────────────────────────────────────────────────────

async function fetchSession(sessionId: string): Promise<any> {
    const { data } = await (await import("../api/http")).http.get<any>(
        `/api/sessions/${sessionId}`,
        { withCredentials: true }
    );
    return data;
}

function resolveTemplateId(session: any): string | undefined {
    return (
        session.activityTemplateId ??
        session.templateId ??
        session.activityId ??
        session.template?.id ??
        session.activity?.id ??
        undefined
    );
}

async function enrichBookings(
    bookings: BookingApi.Booking[]
): Promise<EnrichedTrip[]> {
    const completed = bookings.filter((b) => b.status === "COMPLETED");
    const enriched = await Promise.all(
        completed.map(async (booking): Promise<EnrichedTrip | null> => {
            try {
                const session = await fetchSession(booking.sessionId);
                const templateId = resolveTemplateId(session);

                if (!templateId) {
                    console.warn(
                        `[ActivityTab] Session "${booking.sessionId}" has no resolvable template ID.\n` +
                        `Raw session keys: ${Object.keys(session).join(", ")}`
                    );
                    return {
                        kind: "trip",
                        bookingId: booking.id,
                        sessionId: booking.sessionId,
                        numberOfPeople: booking.numberOfPeople,
                        date: session.date ?? session.startDate ?? session.scheduledAt ?? "",
                        location:
                            session.location ??
                            session.meetingPoint ??
                            session.address ??
                            "Location TBD",
                        title: "Adventure",
                        coverImageUrl: undefined,
                        activitySlug: undefined,
                    };
                }

                const template =
                    await ActivityApi.getPublicTemplateById(templateId);
                console.log("TEMPLATE", template);

                return {
                    kind: "trip",
                    bookingId: booking.id,
                    sessionId: booking.sessionId,
                    numberOfPeople: booking.numberOfPeople,
                    date: session.date ?? session.startDate ?? session.scheduledAt ?? "",
                    location:
                        session.location ??
                        session.meetingPoint ??
                        session.address ??
                        "",
                    title: template.title ?? "Adventure",
                    coverImageUrl: template.coverImageUrl ?? undefined,
                    thumbnail:
                        template.images?.[0]?.url ??
                        template.coverImageUrl ??
                        undefined,
                    activitySlug: template.id,
                };
            } catch (err) {
                console.error(
                    `[ActivityTab] Failed to enrich booking ${booking.id}:`,
                    err
                );
                return null;
            }
        })
    );
    return enriched.filter(Boolean) as EnrichedTrip[];
}

async function enrichReviews(reviews: any[]): Promise<EnrichedReview[]> {
    const enriched = await Promise.all(
        reviews.map(async (review): Promise<EnrichedReview> => {
            try {
                const template = await ActivityApi.getPublicTemplateById(
                    review.activityTemplateId
                );
                return {
                    kind: "review",
                    id: review.id,
                    rating: review.rating,
                    comment: review.comment,
                    createdAt: review.createdAt,
                    activityTemplateId: review.activityTemplateId,
                    activityTitle: template.title ?? "Adventure",
                    coverImageUrl:
                        template.coverImageUrl ??
                        template.images?.[0]?.url ??
                        undefined,
                    governorate: template.governorate ?? "",
                };
            } catch {
                return {
                    kind: "review",
                    id: review.id,
                    rating: review.rating,
                    comment: review.comment,
                    createdAt: review.createdAt,
                    activityTemplateId: review.activityTemplateId,
                    activityTitle: "Adventure",
                    coverImageUrl: undefined,
                    governorate: "",
                };
            }
        })
    );
    return enriched;
}

// ── Skeleton loader ───────────────────────────────────────────────────────────

function SkeletonCard() {
    return (
        <div className={styles.skeletonCard}>
            <div className={styles.skeletonImage} />
            <div className={styles.skeletonBody}>
                <div className={styles.skeletonLine} style={{ width: "65%", height: 20 }} />
                <div className={styles.skeletonLine} style={{ width: "40%", height: 14 }} />
                <div className={styles.skeletonLine} style={{ width: "55%", height: 14 }} />
            </div>
        </div>
    );
}

// ── Empty state ───────────────────────────────────────────────────────────────

function EmptyState({ filter }: { filter: ActivityFilter }) {
    const content = {
        all: {
            title: "No activity yet",
            text: "Your trips and reviews will appear here once you start exploring.",
        },
        trips: {
            title: "No trips yet",
            text: "Complete an adventure and it'll show up here — your personal trail log.",
        },
        reviews: {
            title: "No reviews yet",
            text: "Once you review an adventure, it will appear here.",
        },
    }[filter];

    return (
        <div className={styles.emptyState}>
            <div className={styles.emptyIllustration}>
                <svg viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <circle
                        cx="40"
                        cy="40"
                        r="38"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeDasharray="4 3"
                    />
                    <path
                        d="M24 52 L32 38 L38 46 L46 32 L56 52 Z"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinejoin="round"
                        strokeLinecap="round"
                    />
                    <circle cx="28" cy="30" r="4" stroke="currentColor" strokeWidth="1.5" />
                </svg>
            </div>
            <h3 className={styles.emptyTitle}>{content.title}</h3>
            <p className={styles.emptyText}>{content.text}</p>
        </div>
    );
}

// ── Segmented control ─────────────────────────────────────────────────────────

type SegmentedControlProps = {
    filter: ActivityFilter;
    onChange: (f: ActivityFilter) => void;
    counts: { all: number; trips: number; reviews: number };
};

function SegmentedControl({ filter, onChange, counts }: SegmentedControlProps) {
    const options: { key: ActivityFilter; label: string; count: number }[] = [
        { key: "all", label: "All", count: counts.all },
        { key: "trips", label: "Trips", count: counts.trips },
        { key: "reviews", label: "Reviews", count: counts.reviews },
    ];

    return (
        <div className={styles.segmentedControl} role="tablist" aria-label="Activity filter">
            {options.map((o) => (
                <button
                    key={o.key}
                    role="tab"
                    aria-selected={filter === o.key}
                    className={`${styles.segment} ${filter === o.key ? styles.segmentActive : ""}`}
                    onClick={() => onChange(o.key)}
                >
                    {o.label}
                    <span className={`${styles.segmentCount} ${filter === o.key ? styles.segmentCountActive : ""}`}>
                        {o.count}
                    </span>
                </button>
            ))}
        </div>
    );
}

// ── Main component ────────────────────────────────────────────────────────────

export function ActivityTab() {
    const [trips, setTrips] = useState<EnrichedTrip[]>([]);
    const [reviews, setReviews] = useState<EnrichedReview[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [filter, setFilter] = useState<ActivityFilter>("all");
    const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

    useEffect(() => {
        let alive = true;

        async function load() {
            setLoading(true);
            setError(null);
            try {
                // Load bookings and reviews in parallel
                const [bookings, rawReviews] = await Promise.all([
                    BookingApi.listMyBookings(),
                    ReviewApi.getMyReviews(),
                ]);

                const [enrichedTrips, enrichedReviews] = await Promise.all([
                    enrichBookings(bookings),
                    enrichReviews(rawReviews),
                ]);

                if (alive) {
                    setTrips(
                        enrichedTrips.sort(
                            (a, b) =>
                                new Date(b.date).getTime() - new Date(a.date).getTime()
                        )
                    );
                    setReviews(
                        enrichedReviews.sort((a, b) => {
                            const da = a.createdAt ? new Date(a.createdAt).getTime() : 0;
                            const db = b.createdAt ? new Date(b.createdAt).getTime() : 0;
                            return db - da;
                        })
                    );
                }
            } catch (e: any) {
                if (alive) setError(e?.message ?? "Failed to load activity");
            } finally {
                if (alive) setLoading(false);
            }
        }

        load();
        return () => {
            alive = false;
        };
    }, []);

    // Merged + sorted feed for "all" view
    const allItems = useMemo((): ActivityItem[] => {
        const merged: ActivityItem[] = [...trips, ...reviews];
        merged.sort((a, b) => {
            const dateA = a.kind === "trip" ? a.date : a.createdAt ?? "";
            const dateB = b.kind === "trip" ? b.date : b.createdAt ?? "";
            return new Date(dateB).getTime() - new Date(dateA).getTime();
        });
        return merged;
    }, [trips, reviews]);

    const filteredItems = useMemo((): ActivityItem[] => {
        if (filter === "trips") return trips;
        if (filter === "reviews") return reviews;
        return allItems;
    }, [filter, trips, reviews, allItems]);

    const handleFilterChange = (f: ActivityFilter) => {
        setFilter(f);
        setVisibleCount(PAGE_SIZE);
    };

    const visibleItems = filteredItems.slice(0, visibleCount);
    const remaining = filteredItems.length - visibleCount;
    const hasMore = remaining > 0;

    // ── Loading state ────────────────────────────────────────────────────────

    if (loading) {
        return (
            <div className={styles.wrapper}>
                <div className={styles.feedHeader}>
                    <div className={styles.segmentedControlSkeleton}>
                        {[80, 72, 96].map((w, i) => (
                            <div key={i} className={styles.segmentSkeleton} style={{ width: w }} />
                        ))}
                    </div>
                </div>
                <div className={styles.grid}>
                    {Array.from({ length: 6 }).map((_, i) => (
                        <SkeletonCard key={i} />
                    ))}
                </div>
            </div>
        );
    }

    // ── Error state ──────────────────────────────────────────────────────────

    if (error) {
        return (
            <div className={styles.errorState}>
                <span>⚠</span> {error}
            </div>
        );
    }

    // ── Render ───────────────────────────────────────────────────────────────

    return (
        <div className={styles.wrapper}>
            <div className={styles.feedHeader}>
                <SegmentedControl
                    filter={filter}
                    onChange={handleFilterChange}
                    counts={{
                        all: allItems.length,
                        trips: trips.length,
                        reviews: reviews.length,
                    }}
                />
            </div>

            {filteredItems.length === 0 ? (
                <EmptyState filter={filter} />
            ) : (
                <>
                    <div className={styles.grid}>
                        {visibleItems.map((item, i) =>
                            item.kind === "trip" ? (
                                <TripCard key={item.bookingId} trip={item} index={i} />
                            ) : (
                                <ReviewCard key={item.id} review={item} index={i} />
                            )
                        )}
                    </div>

                    {hasMore && (
                        <div className={styles.loadMoreWrapper}>
                            <button
                                className={styles.loadMoreButton}
                                onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}
                            >
                                Show {Math.min(remaining, PAGE_SIZE)} more
                                <svg
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth={2}
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                >
                                    <path d="M19 9l-7 7-7-7" />
                                </svg>
                            </button>
                            <span className={styles.remainingCount}>
                                {remaining} item{remaining !== 1 ? "s" : ""} remaining
                            </span>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}
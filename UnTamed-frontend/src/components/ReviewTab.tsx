import { useEffect, useState } from "react";
import * as ReviewApi from "../api/review.api";
import * as ActivityApi from "../api/activity.api";
import { ReviewCard } from "./ReviewCard";
import styles from "../style/ReviewTab.module.css";

type EnrichedReview = {
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

async function enrichReviews(reviews: any[]): Promise<EnrichedReview[]> {
    const enriched = await Promise.all(
        reviews.map(async (review) => {
            try {
                const template = await ActivityApi.getPublicTemplateById(review.activityTemplateId);
                console.log("TEMPLATE", template);

                return {
                    kind: "review" as const,
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
                    kind: "review" as const,
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

function EmptyState() {
    return (
        <div className={styles.emptyState}>
            <div className={styles.emptyIcon}>⭐</div>
            <h3 className={styles.emptyTitle}>No reviews yet</h3>
            <p className={styles.emptyText}>
                Once you review an adventure, it will appear here.
            </p>
        </div>
    );
}

function SkeletonCard() {
    return (
        <div className={styles.skeletonCard}>
            <div className={styles.skeletonImage} />
            <div className={styles.skeletonBody}>
                <div className={styles.skeletonLine} style={{ width: "60%", height: 18 }} />
                <div className={styles.skeletonLine} style={{ width: "35%", height: 14 }} />
                <div className={styles.skeletonLine} style={{ width: "100%", height: 60 }} />
            </div>
        </div>
    );
}

export function ReviewTab() {
    const [reviews, setReviews] = useState<EnrichedReview[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let alive = true;

        async function load() {
            setLoading(true);
            setError(null);

            try {
                const raw = await ReviewApi.getMyReviews();
                const enriched = await enrichReviews(raw);

                enriched.sort((a, b) => {
                    const da = a.createdAt ? new Date(a.createdAt).getTime() : 0;
                    const db = b.createdAt ? new Date(b.createdAt).getTime() : 0;
                    return db - da;
                });

                if (alive) setReviews(enriched);
            } catch (e: any) {
                if (alive) setError(e?.message ?? "Failed to load reviews");
            } finally {
                if (alive) setLoading(false);
            }
        }

        load();
        return () => {
            alive = false;
        };
    }, []);

    if (loading) {
        return (
            <div className={styles.grid}>
                <SkeletonCard />
                <SkeletonCard />
            </div>
        );
    }

    if (error) {
        return <div className={styles.errorState}>⚠ {error}</div>;
    }

    if (reviews.length === 0) return <EmptyState />;

    return (
        <div className={styles.wrapper}>
            <div className={styles.feedHeader}>
                <span className={styles.reviewCount}>
                    {reviews.length} review{reviews.length !== 1 ? "s" : ""} written
                </span>
            </div>

            <div className={styles.grid}>
                {reviews.map((review, i) => (
                    <ReviewCard key={review.id} review={review} index={i} />
                ))}
            </div>
        </div>
    );
}
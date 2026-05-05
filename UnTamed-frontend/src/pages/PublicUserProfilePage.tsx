import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Header } from "../components/Header";
import { getPublicUserProfile } from "../api/user.api";
import { listGuideReviews } from "../api/guideReview.api";
import type { GuideReview } from "../api/guideReview.api";
import type {
  PublicGuideReview,
  PublicTopCategory,
  PublicUserProfile,
} from "../types/publicProfile";
import type { PaginatedResponse } from "../types/pagination";
import styles from "../style/public-profile.module.css";

const GUIDE_REVIEWS_SIZE = 10;
const MONGO_ID_PATTERN = /^[a-f\d]{24}$/i;

function roleLabel(role?: string | null) {
  if (role === "GUIDE") return "Guide";
  if (role === "ADMIN") return "Admin";
  return "Adventurer";
}

function initial(name?: string | null) {
  return (name || "U").slice(0, 1).toUpperCase();
}

function formatDate(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function formatJoined(value?: string | null) {
  if (!value) return "Member";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Member";
  return `Joined ${date.toLocaleDateString("en-US", { month: "long", year: "numeric" })}`;
}

function formatMoney(value?: number | null) {
  if (value == null) return "Price unavailable";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "TND",
    maximumFractionDigits: 0,
  }).format(value);
}

function cleanCategoryName(category?: string | null) {
  if (!category || MONGO_ID_PATTERN.test(category)) return "Unknown category";
  return category;
}

function stars(value?: number | null) {
  const rating = Math.max(0, Math.min(5, Math.round(value ?? 0)));
  return "★".repeat(rating) + "☆".repeat(5 - rating);
}

function Skeleton() {
  return (
    <div className={styles.page}>
      <Header />
      <main className={styles.shell} aria-hidden="true">
        <div className={styles.heroSkeleton} />
        <div className={styles.grid}>
          <div className={styles.panelSkeleton} />
          <div className={styles.panelSkeleton} />
        </div>
      </main>
    </div>
  );
}

function Avatar({ profile }: { profile: PublicUserProfile }) {
  return (
    <div className={styles.avatarRing}>
      {profile.profileImageUrl ? (
        <img src={profile.profileImageUrl} alt={profile.username} />
      ) : (
        <span>{initial(profile.username)}</span>
      )}
    </div>
  );
}

function LevelPassport({ profile, large = false }: { profile: PublicUserProfile; large?: boolean }) {
  const progress = Math.max(0, Math.min(100, profile.levelProgressPercent ?? 0));
  const levelNumber = profile.levelNumber ?? 1;
  const title = profile.levelTitle || "Campfire Rookie";
  const isLegend = profile.level === "LEGEND" || levelNumber >= 10;
  const filled = isLegend ? 10 : Math.max(0, Math.min(10, levelNumber - 1));

  return (
    <section className={`${styles.levelCard} ${large ? styles.levelCardLarge : ""} ${isLegend ? styles.levelLegend : ""}`}>
      <div className={styles.levelStamp} aria-hidden="true">
        <span>LV</span>
        <strong>{levelNumber}</strong>
      </div>
      <div className={styles.levelCopy}>
        <span className={styles.eyebrow}>Explorer level</span>
        <h2>{title}</h2>
        <p>{isLegend ? "Untamed Legend · The trail ends here." : `${progress}% progress through this trail segment.`}</p>
        <div
          className={styles.segmentBar}
          role="progressbar"
          aria-label={`Level ${levelNumber}, ${title}`}
          aria-valuenow={isLegend ? 100 : Math.round(((filled + progress / 100) / 10) * 100)}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          {Array.from({ length: 10 }).map((_, index) => {
            const segment = index + 1;
            const width = isLegend || segment <= filled ? 100 : segment === levelNumber ? progress : 0;
            return (
              <span key={segment}>
                <i style={{ width: `${width}%` }} />
              </span>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function TasteProfile({ categories = [] }: { categories?: PublicTopCategory[] }) {
  if (!categories.length) {
    return (
      <section className={styles.panel}>
        <span className={styles.eyebrow}>Taste profile</span>
        <h2>Adventure fingerprint</h2>
        <p className={styles.emptyText}>Complete a few trips to unlock this explorer's favorite adventure categories.</p>
      </section>
    );
  }

  const max = Math.max(...categories.map((category) => category.count), 1);

  return (
    <section className={styles.panel}>
      <span className={styles.eyebrow}>Taste profile</span>
      <h2>Adventure fingerprint</h2>
      <div className={styles.tasteList}>
        {categories.map((category) => (
          <div key={category.categoryId} className={styles.tasteRow}>
            <div>
              <span>{cleanCategoryName(category.categoryName)}</span>
              <strong>{category.count}</strong>
            </div>
            <i style={{ width: `${Math.max(8, (category.count / max) * 100)}%` }} />
          </div>
        ))}
      </div>
    </section>
  );
}

function CredibilityCard({ profile }: { profile: PublicUserProfile }) {
  const guide = profile.guideProfile;
  const rating = guide?.ratingSummary;

  return (
    <section className={styles.panel}>
      <span className={styles.eyebrow}>Guide trust</span>
      <h2>Credibility</h2>
      <div className={styles.credibilityGrid}>
        <div className={guide?.verifiedBadge ? styles.verifiedBox : styles.statBox}>
          <strong>{guide?.verifiedBadge ? "Verified" : "Listed"}</strong>
          <span>{guide?.verifiedBadge ? "Professional guide badge" : "Guide profile"}</span>
        </div>
        <div className={styles.statBox}>
          <strong>{rating?.count ? Number(rating.average).toFixed(1) : "—"}</strong>
          <span>{rating?.count ?? 0} reviews</span>
        </div>
        <div className={styles.statBox}>
          <strong>{guide?.experienceYears ?? "—"}</strong>
          <span>Years experience</span>
        </div>
        <div className={styles.statBox}>
          <strong>{guide?.certificateCount ?? 0}</strong>
          <span>Certificates</span>
        </div>
      </div>
    </section>
  );
}

function Certificates({ profile }: { profile: PublicUserProfile }) {
  const certificates = profile.guideProfile?.certificates ?? [];
  if (!certificates.length) return null;

  return (
    <section className={styles.panel}>
      <span className={styles.eyebrow}>Credentials</span>
      <h2>Certificates</h2>
      <div className={styles.certificateGrid}>
        {certificates.map((certificate, index) => (
          <article key={certificate.id ?? `${certificate.title}-${index}`} className={styles.certificateCard}>
            <strong>{certificate.title || "Certificate"}</strong>
            {certificate.issuer && <span>{certificate.issuer}</span>}
            <small>
              {[formatDate(certificate.issuedAt), certificate.expiresAt ? `Expires ${formatDate(certificate.expiresAt)}` : ""]
                .filter(Boolean)
                .join(" · ")}
            </small>
            {certificate.verificationUrl && (
              <a href={certificate.verificationUrl} target="_blank" rel="noreferrer">
                Verify credential
              </a>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}

function GuideActivities({ profile }: { profile: PublicUserProfile }) {
  const activities = profile.guideActivities ?? [];

  return (
    <section className={styles.panel}>
      <span className={styles.eyebrow}>Trips</span>
      <h2>Activities offered</h2>
      {!activities.length ? (
        <p className={styles.emptyText}>No public activities are available from this guide yet.</p>
      ) : (
        <div className={styles.activityGrid}>
          {activities.map((activity) => (
            <Link key={activity.id} to={`/activities/${activity.id}`} className={styles.activityCard}>
              <div className={styles.activityImage}>
                {activity.coverImageUrl ? <img src={activity.coverImageUrl} alt="" /> : <span>{initial(activity.title)}</span>}
              </div>
              <div>
                <strong>{activity.title}</strong>
                <p>{activity.location || activity.governorate || "Tunisia"}</p>
                <div className={styles.activityMeta}>
                  <span>{activity.difficulty || "Adventure"}</span>
                  <span>{formatMoney(activity.price)}</span>
                </div>
                {!!activity.categoryNames?.length && (
                  <div className={styles.pillRow}>
                    {activity.categoryNames.slice(0, 3).map((name) => (
                      <span key={name}>{cleanCategoryName(name)}</span>
                    ))}
                  </div>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}

function normalizeGuideReview(review: GuideReview): PublicGuideReview {
  return {
    id: review.id,
    reviewerUsername: review.reviewer?.username ?? "Adventurer",
    reviewerProfileImageUrl: review.reviewer?.profileImageUrl ?? null,
    reviewerLevel: review.reviewer?.level ?? null,
    reviewerLevelTitle: null,
    rating: review.rating,
    comment: review.comment,
    createdAt: review.createdAt,
  };
}

function GuideReviews({ profile }: { profile: PublicUserProfile }) {
  const initialReviews = useMemo(() => profile.guideReviews ?? [], [profile.guideReviews]);
  const [reviews, setReviews] = useState<PublicGuideReview[]>(initialReviews);
  const [page, setPage] = useState(0);
  const [last, setLast] = useState((profile.guideStats?.totalReviewsCount ?? initialReviews.length) <= initialReviews.length);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setReviews(initialReviews);
    setPage(0);
    setLast((profile.guideStats?.totalReviewsCount ?? initialReviews.length) <= initialReviews.length);
    setError("");
  }, [initialReviews, profile.id, profile.guideStats?.totalReviewsCount]);

  async function loadMore() {
    if (loading || last) return;
    setLoading(true);
    setError("");
    try {
      const nextPage = page + 1;
      const response: PaginatedResponse<GuideReview> = await listGuideReviews(profile.id, nextPage, GUIDE_REVIEWS_SIZE);
      setReviews((prev) => [...prev, ...response.content.map(normalizeGuideReview)]);
      setPage(response.page);
      setLast(response.last);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load more guide reviews.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className={styles.panel}>
      <span className={styles.eyebrow}>Guide reviews</span>
      <h2>What adventurers say</h2>
      {!reviews.length ? (
        <p className={styles.emptyText}>No guide reviews yet.</p>
      ) : (
        <div className={styles.reviewList}>
          {reviews.map((review) => (
            <article key={review.id} className={styles.reviewCard}>
              <div className={styles.reviewAvatar}>
                {review.reviewerProfileImageUrl ? (
                  <img src={review.reviewerProfileImageUrl} alt={review.reviewerUsername || "Adventurer"} />
                ) : (
                  <span>{initial(review.reviewerUsername)}</span>
                )}
              </div>
              <div>
                <div className={styles.reviewTopline}>
                  <strong>{review.reviewerUsername || "Adventurer"}</strong>
                  <span aria-label={`${review.rating ?? 0} out of 5 stars`}>{stars(review.rating)}</span>
                </div>
                {(review.reviewerLevelTitle || review.reviewerLevel) && (
                  <small>{review.reviewerLevelTitle || review.reviewerLevel}</small>
                )}
                <p>{review.comment}</p>
                <time>{formatDate(review.createdAt)}</time>
              </div>
            </article>
          ))}
        </div>
      )}
      {error && <p className={styles.errorText}>{error}</p>}
      {!last && (
        <button type="button" className={styles.loadMoreButton} onClick={loadMore} disabled={loading}>
          {loading ? "Loading reviews..." : "Load more reviews"}
        </button>
      )}
    </section>
  );
}

function RecentReviews({ profile }: { profile: PublicUserProfile }) {
  const reviews = profile.recentReviews ?? [];

  return (
    <section className={styles.panel}>
      <span className={styles.eyebrow}>Reviews written</span>
      <h2>Recent field notes</h2>
      {!reviews.length ? (
        <p className={styles.emptyText}>No public reviews yet.</p>
      ) : (
        <div className={styles.reviewList}>
          {reviews.map((review) => (
            <article key={review.id} className={`${styles.reviewCard} ${styles.activityReviewCard}`}>
              <Link to={`/activities/${review.activityTemplateId}`} className={styles.reviewImage}>
                {review.activityImageUrl ? <img src={review.activityImageUrl} alt="" /> : <span>{initial(review.activityTitle)}</span>}
              </Link>
              <div>
                <div className={styles.reviewTopline}>
                  <Link to={`/activities/${review.activityTemplateId}`}>{review.activityTitle}</Link>
                  <span aria-label={`${review.rating ?? 0} out of 5 stars`}>{stars(review.rating)}</span>
                </div>
                <p>{review.comment}</p>
                <time>{formatDate(review.createdAt)}</time>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function Hero({ profile }: { profile: PublicUserProfile }) {
  const isGuide = profile.role === "GUIDE";
  const stats = isGuide
    ? [
        { value: profile.guideStats?.activitiesCount ?? 0, label: "Activities" },
        { value: profile.guideStats?.totalReviewsCount ?? 0, label: "Reviews" },
        { value: profile.guideStats?.averageRating ? Number(profile.guideStats.averageRating).toFixed(1) : "—", label: "Rating" },
      ]
    : [
        { value: profile.confirmedTripsCount ?? 0, label: "Trips" },
        { value: profile.reviewsWrittenCount ?? 0, label: "Reviews" },
        { value: profile.levelNumber ?? 1, label: "Level" },
      ];

  return (
    <section className={styles.hero}>
      <div className={styles.cover} />
      <div className={styles.heroBody}>
        <Avatar profile={profile} />
        <div className={styles.identity}>
          <div className={styles.roleLine}>
            <span className={`${styles.rolePill} ${isGuide ? styles.roleGuide : ""}`}>{roleLabel(profile.role)}</span>
            {isGuide && profile.guideProfile?.verifiedBadge && <span className={styles.verifiedPill}>Professional guide</span>}
          </div>
          <h1>{profile.username}</h1>
          <p>{formatJoined(profile.createdAt)}</p>
          {profile.bio && <blockquote>{profile.bio}</blockquote>}
        </div>
        <div className={styles.heroStats}>
          {stats.map((stat) => (
            <div key={stat.label}>
              <strong>{stat.value}</strong>
              <span>{stat.label}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export default function PublicUserProfilePage() {
  const { userId } = useParams();
  const [profile, setProfile] = useState<PublicUserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notFound, setNotFound] = useState(false);

  const loadProfile = useCallback(async () => {
    if (!userId) {
      setNotFound(true);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");
    setNotFound(false);

    try {
      const data = await getPublicUserProfile(userId);
      setProfile(data);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Could not load profile.";
      if (/HTTP 404/i.test(message)) {
        setNotFound(true);
      } else {
        setError(message);
      }
      setProfile(null);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

  if (loading) return <Skeleton />;

  if (notFound) {
    return (
      <div className={styles.page}>
        <Header />
        <main className={styles.stateCard}>
          <h1>Profile not found</h1>
          <p>This public profile is unavailable or no longer active.</p>
          <Link to="/home">Back to UnTamed</Link>
        </main>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className={styles.page}>
        <Header />
        <main className={styles.stateCard}>
          <h1>Could not load profile</h1>
          <p>{error || "Something went wrong while loading this public profile."}</p>
          <button type="button" onClick={loadProfile}>Try again</button>
        </main>
      </div>
    );
  }

  const isGuide = profile.role === "GUIDE";
  const isAdventurer = profile.role === "ADVENTURER" || profile.role === "USER";

  return (
    <div className={styles.page}>
      <Header />
      <main className={styles.shell}>
        <Hero profile={profile} />

        <div className={styles.layout}>
          <aside className={styles.sideColumn}>
            <LevelPassport profile={profile} />
            {isGuide && <CredibilityCard profile={profile} />}
            {isAdventurer && <TasteProfile categories={profile.topCategories} />}
          </aside>

          <div className={styles.mainColumn}>
            {isAdventurer && (
              <>
                <LevelPassport profile={profile} large />
                <TasteProfile categories={profile.topCategories} />
                <RecentReviews profile={profile} />
              </>
            )}

            {isGuide && (
              <>
                <Certificates profile={profile} />
                <GuideActivities profile={profile} />
                <GuideReviews profile={profile} />
              </>
            )}

            {!isAdventurer && !isGuide && (
              <section className={styles.panel}>
                <span className={styles.eyebrow}>Public profile</span>
                <h2>{profile.username}</h2>
                <p className={styles.emptyText}>This account has a minimal public profile.</p>
              </section>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/auth.store";
import * as GuideApi from "../api/guide.api";
import type { GuideProfileResponse } from "../api/guide.api";
import * as UserApi from "../api/user.api";
import type { ProfileActivityFeed } from "../api/user.api";
import { ActivityTab } from "../components/ActivityTab";
import { Header } from "../components/Header";
import { ReviewTab } from "../components/ReviewTab";
import type { AuthUser } from "../types/auth";
import styles from "../style/Profilepage.module.css";

type TabType = "about" | "guide" | "activity" | "reviews";

type TasteCategory = {
  id: string;
  name: string;
  count: number;
};

const PROFILE_TRIPS_PAGE_SIZE = 10;
const PROFILE_REVIEWS_PAGE_SIZE = 10;
const MONGO_ID_PATTERN = /^[a-f\d]{24}$/i;

function displayCategoryName(categoryName?: string | null) {
  if (!categoryName || MONGO_ID_PATTERN.test(categoryName)) {
    return "Unknown category";
  }
  return categoryName;
}

function Icon({ name }: { name: "arrow" | "shield" | "map" | "mail" | "phone" | "award" | "compass" | "star" }) {
  const paths = {
    arrow: <path d="M19 12H5m7-7-7 7 7 7" />,
    shield: <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Zm-3.5-10.5 2.2 2.2 4.8-5" />,
    map: <path d="M9 18 3 21V6l6-3 6 3 6-3v15l-6 3-6-3Zm0 0V3m6 18V6" />,
    mail: <path d="M4 6h16v12H4V6Zm0 1 8 6 8-6" />,
    phone: <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.7 19.7 0 0 1-8.6-3.1 19.4 19.4 0 0 1-6-6A19.7 19.7 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7l.4 2.7a2 2 0 0 1-.6 1.8L7.6 9.5a16 16 0 0 0 6.9 6.9l1.3-1.3a2 2 0 0 1 1.8-.6l2.7.4a2 2 0 0 1 1.7 2Z" />,
    award: <path d="M12 15a6 6 0 1 0 0-12 6 6 0 0 0 0 12Zm-3.5-1.2L7 22l5-3 5 3-1.5-8.2" />,
    compass: <path d="m16.2 7.8-2.1 6.3-6.3 2.1 2.1-6.3 6.3-2.1ZM12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Z" />,
    star: <path d="m12 2 2.9 6 6.6.9-4.8 4.6 1.1 6.5-5.8-3.1L6.2 20l1.1-6.5L2.5 8.9 9.1 8 12 2Z" />,
  };

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      {paths[name]}
    </svg>
  );
}

function formatMemberSince(value?: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

function yearsAsMember(value?: string | null) {
  if (!value) return "New";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "New";
  const years = Math.max(0, new Date().getFullYear() - date.getFullYear());
  return years > 0 ? `${years}y` : "New";
}

function levelScore(level?: string | null) {
  if (level === "EXPERT") return 5;
  if (level === "ADVANCED") return 4;
  if (level === "INTERMEDIATE") return 3;
  if (level === "BEGINNER") return 2;
  return 1;
}

function ProfileSkeleton() {
  return (
    <div className={styles.loadingPage} aria-hidden="true">
      <div className={styles.profileSkeleton} />
      <div className={styles.contentSkeleton}>
        <div />
        <div />
        <div />
      </div>
    </div>
  );
}

function ProfileCard({
  displayName,
  user,
  guide,
  isGuide,
  activityFeed,
  onBack,
}: {
  displayName: string;
  user: AuthUser;
  guide: GuideProfileResponse | null;
  isGuide: boolean;
  activityFeed: ProfileActivityFeed | null;
  onBack: () => void;
}) {
  const avatarInitial = displayName.slice(0, 1).toUpperCase() || "U";
  const roleLabel = isGuide ? "Guide" : "Adventure Seeker";
  const verifiedGuide = isGuide && (user.verified || guide?.verifiedBadge);
  const stats = isGuide
    ? [
        { value: guide?.ratingSummary?.average ?? "-", label: "Rating" },
        { value: guide?.ratingSummary?.count ?? 0, label: "Reviews" },
        { value: guide?.experienceYears ?? guide?.certificates?.length ?? 0, label: guide?.experienceYears ? "Years" : "Certs" },
      ]
    : [
        { value: activityFeed?.summary.completedTripsCount ?? user.confirmedTripsCount ?? 0, label: "Trips" },
        { value: activityFeed?.summary.reviewsCount ?? user.reviewsWrittenCount ?? 0, label: "Reviews" },
        { value: yearsAsMember(user.createdAt), label: "Member" },
      ];

  return (
    <aside className={styles.profileCard}>
      <button type="button" className={styles.backButton} onClick={onBack} aria-label="Go back">
        <Icon name="arrow" />
        <span>Back</span>
      </button>

      <div className={styles.coverStrip} />

      <div className={styles.avatarWrap}>
        <div className={`${styles.avatarRing} ${verifiedGuide ? styles.avatarRingGuide : ""}`}>
          {user.profileImageUrl ? (
            <img src={user.profileImageUrl} alt={displayName} className={styles.avatar} />
          ) : (
            <span className={styles.avatarFallback}>{avatarInitial}</span>
          )}
        </div>
        {verifiedGuide && (
          <span className={styles.verifiedBadge} aria-label="Verified guide">
            <Icon name="shield" />
          </span>
        )}
      </div>

      <div className={styles.identity}>
        <h1>{displayName}</h1>
        <p>{roleLabel}</p>
        <div className={styles.identityPills}>
          <span className={`${styles.rolePill} ${isGuide ? styles.rolePillGuide : ""}`}>
            {isGuide && <Icon name="shield" />}
            {roleLabel}
          </span>
          {verifiedGuide && <span className={styles.goldPill}>Verified</span>}
        </div>
      </div>

      <div className={styles.levelBlock}>
        <span>{user.level || "Explorer"}</span>
        <div className={styles.levelDots} aria-label={`Level ${user.level || "Explorer"}`}>
          {Array.from({ length: 5 }).map((_, index) => (
            <i key={index} className={index < levelScore(user.level) ? styles.levelDotActive : ""} />
          ))}
        </div>
      </div>

      <div className={styles.profileStats}>
        {stats.map((stat) => (
          <div key={stat.label}>
            <strong>{stat.value}</strong>
            <span>{stat.label}</span>
          </div>
        ))}
      </div>

      <Link to="/profile/edit" className={styles.editProfileButton}>
        Edit profile
      </Link>
    </aside>
  );
}

function ProfileTabNav({
  tabs,
  activeTab,
  onChange,
}: {
  tabs: { id: TabType; label: string }[];
  activeTab: TabType;
  onChange: (tab: TabType) => void;
}) {
  return (
    <nav className={styles.tabNav} role="tablist" aria-label="Profile sections">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          role="tab"
          aria-selected={activeTab === tab.id}
          className={`${styles.tabButton} ${activeTab === tab.id ? styles.tabButtonActive : ""}`}
          onClick={() => onChange(tab.id)}
        >
          {tab.label}
        </button>
      ))}
    </nav>
  );
}

function PersonalInfoGrid({ user }: { user: AuthUser }) {
  const items = [
    { icon: "mail" as const, label: "Email", value: user.email },
    { icon: "phone" as const, label: "Phone", value: user.phoneNumber },
    { icon: "compass" as const, label: "Level", value: user.level },
    { icon: "map" as const, label: "Member since", value: formatMemberSince(user.createdAt) },
  ].filter((item) => item.value);

  return (
    <div className={styles.infoGrid}>
      {items.map((item) => (
        <div key={item.label} className={styles.infoRow}>
          <span className={styles.infoIcon}>
            <Icon name={item.icon} />
          </span>
          <span>{item.label}</span>
          <strong>{item.value}</strong>
        </div>
      ))}
    </div>
  );
}

function InterestTagCloud({ preferences }: { preferences?: string[] | null }) {
  const tags = (preferences ?? []).filter(Boolean).slice(0, 6);

  if (tags.length === 0) {
    return <p className={styles.softEmpty}>Add your interests so guides can tailor recommendations for you.</p>;
  }

  return (
    <div className={styles.tagCloud}>
      {tags.map((tag) => (
        <span key={tag}>{tag}</span>
      ))}
    </div>
  );
}

function TasteProfileBars({ categories }: { categories: TasteCategory[] }) {
  const max = Math.max(...categories.map((category) => category.count), 1);

  return (
    <section className={styles.panel}>
      <div className={styles.panelHeader}>
        <span className={styles.eyebrow}>Taste profile</span>
        <h2>Your adventure fingerprint</h2>
      </div>

      {categories.length === 0 ? (
        <div className={styles.emptyFingerprint}>
          <Icon name="compass" />
          <p>Complete your first trip to unlock your taste profile.</p>
        </div>
      ) : (
        <div className={styles.tasteBars}>
          {categories.map((category) => (
            <div key={category.id} className={styles.tasteRow}>
              <div className={styles.tasteMeta}>
                <span>{displayCategoryName(category.name)}</span>
                <strong>{category.count}</strong>
              </div>
              <div className={styles.tasteTrack}>
                <i style={{ width: `${Math.max(12, Math.round((category.count / max) * 100))}%` }} />
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function AboutTab({
  user,
  topCategories,
}: {
  user: AuthUser;
  topCategories: TasteCategory[];
}) {
  return (
    <div className={styles.tabPanel}>
      <section className={styles.panel}>
        <div className={styles.panelHeader}>
          <span className={styles.eyebrow}>Field notes</span>
          <h2>About</h2>
        </div>
        <blockquote className={styles.bioQuote}>
          {user.bio || "Share your story - what drives you into the wild?"}
        </blockquote>
      </section>

      <section className={styles.panel}>
        <div className={styles.panelHeader}>
          <span className={styles.eyebrow}>Passport details</span>
          <h2>Personal info</h2>
        </div>
        <PersonalInfoGrid user={user} />
      </section>

      <section className={styles.panel}>
        <div className={styles.panelHeader}>
          <span className={styles.eyebrow}>Interests</span>
          <h2>Trail preferences</h2>
        </div>
        <InterestTagCloud preferences={user.preferences} />
      </section>

      <TasteProfileBars categories={topCategories} />
    </div>
  );
}

function GuideExperienceTab({
  guide,
  loading,
  error,
}: {
  guide: GuideProfileResponse | null;
  loading: boolean;
  error: string | null;
}) {
  if (loading) {
    return (
      <div className={styles.tabPanel}>
        <div className={styles.panelSkeleton} aria-hidden="true" />
        <div className={styles.panelSkeleton} aria-hidden="true" />
      </div>
    );
  }

  if (error) {
    return <div className={styles.errorState}>{error}</div>;
  }

  return (
    <div className={styles.tabPanel}>
      <section className={`${styles.panel} ${styles.credibilityPanel}`}>
        <div className={styles.credIcon}>
          <Icon name="award" />
        </div>
        <div>
          <span className={styles.eyebrow}>Guide credibility</span>
          <h2>{guide?.verifiedBadge ? "Verified Professional Guide" : "Guide profile"}</h2>
          <p>
            {guide?.ratingSummary?.count
              ? `${guide.ratingSummary.average} average rating across ${guide.ratingSummary.count} reviews.`
              : "Too few reviews to rate."}
          </p>
        </div>
      </section>

      <section className={styles.panel}>
        <div className={styles.panelHeader}>
          <span className={styles.eyebrow}>Experience</span>
          <h2>Professional trail record</h2>
        </div>
        <div className={styles.guideStatsGrid}>
          <div>
            <strong>{guide?.experienceYears ?? "-"}</strong>
            <span>Years experience</span>
          </div>
          <div>
            <strong>{guide?.certificates?.length ?? 0}</strong>
            <span>Certificates</span>
          </div>
          <div>
            <strong>{guide?.ratingSummary?.count ?? 0}</strong>
            <span>Guide reviews</span>
          </div>
        </div>
      </section>

      {guide?.certificates && guide.certificates.length > 0 && (
        <section className={styles.panel}>
          <div className={styles.panelHeader}>
            <span className={styles.eyebrow}>Credentials</span>
            <h2>Certificates</h2>
          </div>
          <div className={styles.certificateGrid}>
            {guide.certificates.map((certificate) => (
              <article key={certificate.id} className={styles.certificateCard}>
                <Icon name="shield" />
                <div>
                  <h3>{certificate.title}</h3>
                  <p>{certificate.issuer || "Issuer not provided"}</p>
                  {certificate.expiresAt && <span>Expires {formatMemberSince(certificate.expiresAt)}</span>}
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      <Link to="/profile/guide/edit" className={styles.secondaryAction}>
        Edit guide profile
      </Link>
    </div>
  );
}

export function ProfilePage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [guide, setGuide] = useState<GuideProfileResponse | null>(null);
  const [guideLoading, setGuideLoading] = useState(false);
  const [guideErr, setGuideErr] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>("about");
  const [topCategories, setTopCategories] = useState<TasteCategory[]>([]);
  const [activityFeed, setActivityFeed] = useState<ProfileActivityFeed | null>(null);
  const [activityFeedLoading, setActivityFeedLoading] = useState(true);
  const [activityFeedError, setActivityFeedError] = useState<string | null>(null);
  const [loadingMoreTrips, setLoadingMoreTrips] = useState(false);
  const [loadingMoreReviews, setLoadingMoreReviews] = useState(false);

  const isGuide = user?.role === "GUIDE";
  const tabs = useMemo<{ id: TabType; label: string }[]>(
    () => [
      { id: "about", label: "About" },
      ...(isGuide ? [{ id: "guide" as TabType, label: "Experience" }] : []),
      { id: "activity", label: "Activity" },
      { id: "reviews", label: "Reviews" },
    ],
    [isGuide]
  );

  useEffect(() => {
    const hash = location.hash.replace("#", "") as TabType;
    if (hash && tabs.some((tab) => tab.id === hash)) {
      setActiveTab(hash);
    }
  }, [location.hash, tabs]);

  useEffect(() => {
    let alive = true;

    async function loadActivityFeed() {
      setActivityFeedLoading(true);
      setActivityFeedError(null);
      try {
        const feed = await UserApi.getMyActivityFeed({
          tripsPage: 0,
          tripsSize: PROFILE_TRIPS_PAGE_SIZE,
          reviewsPage: 0,
          reviewsSize: PROFILE_REVIEWS_PAGE_SIZE,
        });

        if (!alive) return;
        setActivityFeed(feed);
        setTopCategories(
          feed.topCategories.map((category) => ({
            id: category.categoryId,
            name: displayCategoryName(category.categoryName),
            count: category.count,
          }))
        );
      } catch (e: any) {
        if (!alive) return;
        setActivityFeedError(e?.message ?? "Failed to load profile activity");
        setActivityFeed(null);
        setTopCategories([]);
      } finally {
        if (alive) setActivityFeedLoading(false);
      }
    }

    loadActivityFeed();
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    let alive = true;

    async function loadGuide() {
      if (!isGuide) {
        setGuide(null);
        return;
      }
      setGuideLoading(true);
      setGuideErr(null);
      try {
        const guideProfile = await GuideApi.getGuideMe();
        if (alive) setGuide(guideProfile);
      } catch (e: any) {
        if (alive) setGuideErr(e?.message ?? "Failed to load guide profile");
      } finally {
        if (alive) setGuideLoading(false);
      }
    }

    loadGuide();
    return () => {
      alive = false;
    };
  }, [isGuide]);

  const handleLoadMoreTrips = async () => {
    if (!activityFeed || activityFeed.completedTrips.last || loadingMoreTrips) return;

    setLoadingMoreTrips(true);
    setActivityFeedError(null);
    try {
      const next = await UserApi.getMyActivityFeed({
        tripsPage: activityFeed.completedTrips.page + 1,
        tripsSize: PROFILE_TRIPS_PAGE_SIZE,
        reviewsPage: activityFeed.reviews.page,
        reviewsSize: PROFILE_REVIEWS_PAGE_SIZE,
      });

      setActivityFeed((prev) => {
        if (!prev) return next;
        return {
          ...next,
          completedTrips: {
            ...next.completedTrips,
            content: [...prev.completedTrips.content, ...next.completedTrips.content],
          },
          reviews: prev.reviews,
          topCategories: prev.topCategories,
          summary: prev.summary,
        };
      });
    } catch (e: any) {
      setActivityFeedError(e?.message ?? "Failed to load more trips");
    } finally {
      setLoadingMoreTrips(false);
    }
  };

  const handleLoadMoreReviews = async () => {
    if (!activityFeed || activityFeed.reviews.last || loadingMoreReviews) return;

    setLoadingMoreReviews(true);
    setActivityFeedError(null);
    try {
      const next = await UserApi.getMyActivityFeed({
        tripsPage: activityFeed.completedTrips.page,
        tripsSize: PROFILE_TRIPS_PAGE_SIZE,
        reviewsPage: activityFeed.reviews.page + 1,
        reviewsSize: PROFILE_REVIEWS_PAGE_SIZE,
      });

      setActivityFeed((prev) => {
        if (!prev) return next;
        return {
          ...next,
          completedTrips: prev.completedTrips,
          reviews: {
            ...next.reviews,
            content: [...prev.reviews.content, ...next.reviews.content],
          },
          topCategories: prev.topCategories,
          summary: prev.summary,
        };
      });
    } catch (e: any) {
      setActivityFeedError(e?.message ?? "Failed to load more reviews");
    } finally {
      setLoadingMoreReviews(false);
    }
  };

  const displayName = useMemo(() => {
    if (!user) return "";
    return user.username || user.email || "Explorer";
  }, [user]);

  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
    navigate(`#${tab}`, { replace: true });
  };

  if (loading) {
    return (
      <>
        <Header />
        <ProfileSkeleton />
      </>
    );
  }

  if (!user) {
    return (
      <>
        <Header />
        <div className={styles.loading}>Not authenticated</div>
      </>
    );
  }

  return (
    <>
      <Header />
      <main className={styles.pageWrapper}>
        <div className={styles.profileLayout}>
          <ProfileCard
            displayName={displayName}
            user={user}
            guide={guide}
            isGuide={Boolean(isGuide)}
            activityFeed={activityFeed}
            onBack={() => navigate(-1)}
          />

          <section className={styles.contentColumn}>
            <ProfileTabNav tabs={tabs} activeTab={activeTab} onChange={handleTabChange} />

            <div role="tabpanel" className={styles.contentSurface}>
              {activeTab === "about" && <AboutTab user={user} topCategories={topCategories} />}

              {activeTab === "guide" && isGuide && (
                <GuideExperienceTab guide={guide} loading={guideLoading} error={guideErr} />
              )}

              {activeTab === "activity" && (
                <ActivityTab
                  trips={activityFeed?.completedTrips ?? null}
                  reviews={activityFeed?.reviews ?? null}
                  loading={activityFeedLoading}
                  error={activityFeedError}
                  loadingMoreTrips={loadingMoreTrips}
                  loadingMoreReviews={loadingMoreReviews}
                  onLoadMoreTrips={handleLoadMoreTrips}
                  onLoadMoreReviews={handleLoadMoreReviews}
                />
              )}

              {activeTab === "reviews" && (
                <ReviewTab
                  reviews={activityFeed?.reviews ?? null}
                  loading={activityFeedLoading}
                  loadingMore={loadingMoreReviews}
                  error={activityFeedError}
                  onLoadMore={handleLoadMoreReviews}
                />
              )}
            </div>
          </section>
        </div>
      </main>
    </>
  );
}

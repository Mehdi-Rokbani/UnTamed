import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/auth.store";
import * as GuideApi from "../api/guide.api";
import type { GuideProfileResponse } from "../api/guide.api";
import * as GuideReviewApi from "../api/guideReview.api";
import type { GuideReview } from "../api/guideReview.api";
import * as UserApi from "../api/user.api";
import type { ProfileActivityFeed } from "../api/user.api";
import { ActivityTab } from "../components/ActivityTab";
import { Header } from "../components/Header";
import { ReviewTab } from "../components/ReviewTab";
import type { AuthUser, Level } from "../types/auth";
import type { PaginatedResponse } from "../types/pagination";
import styles from "../style/Profilepage.module.css";

type TabType = "about" | "guide" | "activity" | "reviews";

type TasteCategory = {
  id: string;
  name: string;
  count: number;
};

type LevelSource = {
  level?: Level | string | null;
  xp?: number | null;
  levelNumber?: number | null;
  levelTitle?: string | null;
  xpToNextLevel?: number | null;
  levelProgressPercent?: number | null;
};

type NormalizedLevelData = {
  level: Level | string;
  xp: number;
  levelNumber: number;
  levelTitle: string;
  xpToNextLevel: number;
  levelProgressPercent: number;
};

type GuideCredibilityData = {
  verifiedBadge: boolean;
  ratingAverage: number | null;
  ratingCount: number;
  experienceYears: number | null;
  certificateCount: number;
};

function getLevelData(user: AuthUser, activityFeed: ProfileActivityFeed | null): NormalizedLevelData {
  const userLevel = user as AuthUser & LevelSource;
  const summary = activityFeed?.summary;
  const rawLevelNumber = userLevel.levelNumber ?? summary?.levelNumber ?? 1;
  const rawProgress = userLevel.levelProgressPercent ?? summary?.levelProgressPercent ?? 0;
  const isMax = userLevel.level === "LEGEND" || rawLevelNumber >= 10;

  return {
    level: userLevel.level ?? summary?.level ?? "BEGINNER",
    xp: userLevel.xp ?? summary?.xp ?? 0,
    levelNumber: Math.min(10, Math.max(1, rawLevelNumber)),
    levelTitle: userLevel.levelTitle ?? summary?.levelTitle ?? "Campfire Rookie",
    xpToNextLevel: isMax ? 0 : userLevel.xpToNextLevel ?? summary?.xpToNextLevel ?? 200,
    levelProgressPercent: isMax ? 100 : rawProgress,
  };
}

function formatLevelTier(level?: string | null) {
  if (!level) return "Beginner";
  return level
    .toLowerCase()
    .split("_")
    .map((part) => part.slice(0, 1).toUpperCase() + part.slice(1))
    .join(" ");
}

function clampProgress(value?: number | null) {
  return Math.min(100, Math.max(0, value ?? 0));
}

function nextLevelTitle(levelNumber?: number | null) {
  const nextTitles: Record<number, string> = {
    1: "Trail Starter",
    2: "Weekend Explorer",
    3: "Wild Explorer",
    4: "Route Finder",
    5: "Pathfinder",
    6: "Expedition Leader",
    7: "Trail Master",
    8: "Wilderness Expert",
    9: "Untamed Legend",
  };

  return nextTitles[levelNumber ?? 1] ?? "next level";
}

function isMaxLevel(levelData: NormalizedLevelData) {
  return levelData.level === "LEGEND" || levelData.levelNumber >= 10;
}

function getGuideCredibilityData(user: AuthUser, guide: GuideProfileResponse | null): GuideCredibilityData {
  const authGuide = user.guideProfile;
  const ratingAverage = guide?.ratingSummary?.average ?? authGuide?.ratingSummary?.average ?? null;
  const ratingCount = guide?.ratingSummary?.count ?? authGuide?.ratingSummary?.count ?? 0;
  const certificateCount = guide?.certificates?.length ?? authGuide?.certificateCount ?? authGuide?.certificates?.length ?? 0;

  return {
    verifiedBadge: authGuide?.verifiedBadge === true || guide?.verifiedBadge === true,
    ratingAverage,
    ratingCount,
    experienceYears: guide?.experienceYears ?? authGuide?.experienceYears ?? null,
    certificateCount,
  };
}

function getGuideRankTitle(credibility: GuideCredibilityData) {
  const average = credibility.ratingAverage ?? 0;

  if (
    credibility.verifiedBadge &&
    average >= 4.8 &&
    credibility.ratingCount >= 50 &&
    credibility.certificateCount >= 3
  ) {
    return "Master Guide";
  }

  if (credibility.verifiedBadge && average >= 4.6 && credibility.ratingCount >= 20) {
    return "Expert Guide";
  }

  if (credibility.verifiedBadge && credibility.ratingCount >= 10) {
    return "Trusted Guide";
  }

  if (credibility.verifiedBadge) {
    return "Verified Guide";
  }

  return "Guide";
}

function formatGuideRating(credibility: GuideCredibilityData) {
  if (credibility.ratingAverage !== null && credibility.ratingCount > 0) {
    return `${credibility.ratingAverage.toFixed(1)} \u2605 \u00b7 ${credibility.ratingCount} review${credibility.ratingCount === 1 ? "" : "s"}`;
  }

  return "Building guide reputation";
}

const PROFILE_TRIPS_PAGE_SIZE = 10;
const PROFILE_REVIEWS_PAGE_SIZE = 10;
const GUIDE_REVIEWS_PAGE_SIZE = 10;
const MONGO_ID_PATTERN = /^[a-f\d]{24}$/i;

function displayCategoryName(categoryName?: string | null) {
  if (!categoryName || MONGO_ID_PATTERN.test(categoryName)) {
    return "Unknown category";
  }
  return categoryName;
}

function Icon({ name }: { name: "arrow" | "shield" | "map" | "mail" | "phone" | "award" | "compass" | "star" | "eye" }) {
  const paths = {
    arrow: <path d="M19 12H5m7-7-7 7 7 7" />,
    shield: <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Zm-3.5-10.5 2.2 2.2 4.8-5" />,
    map: <path d="M9 18 3 21V6l6-3 6 3 6-3v15l-6 3-6-3Zm0 0V3m6 18V6" />,
    mail: <path d="M4 6h16v12H4V6Zm0 1 8 6 8-6" />,
    phone: <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.7 19.7 0 0 1-8.6-3.1 19.4 19.4 0 0 1-6-6A19.7 19.7 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7l.4 2.7a2 2 0 0 1-.6 1.8L7.6 9.5a16 16 0 0 0 6.9 6.9l1.3-1.3a2 2 0 0 1 1.8-.6l2.7.4a2 2 0 0 1 1.7 2Z" />,
    award: <path d="M12 15a6 6 0 1 0 0-12 6 6 0 0 0 0 12Zm-3.5-1.2L7 22l5-3 5 3-1.5-8.2" />,
    compass: <path d="m16.2 7.8-2.1 6.3-6.3 2.1 2.1-6.3 6.3-2.1ZM12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Z" />,
    star: <path d="m12 2 2.9 6 6.6.9-4.8 4.6 1.1 6.5-5.8-3.1L6.2 20l1.1-6.5L2.5 8.9 9.1 8 12 2Z" />,
    eye: <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Zm10 3a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />,
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

function formatShortDate(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function yearsAsMember(value?: string | null) {
  if (!value) return "New";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "New";
  const years = Math.max(0, new Date().getFullYear() - date.getFullYear());
  return years > 0 ? `${years}y` : "New";
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

function TierPill({ level, max = false }: { level?: string | null; max?: boolean }) {
  return (
    <span className={`${styles.tierPill} ${max ? styles.tierPillLegend : ""}`}>
      {formatLevelTier(level)}
    </span>
  );
}

function BadgeStamp({
  levelData,
  compact = false,
}: {
  levelData: NormalizedLevelData;
  compact?: boolean;
}) {
  const max = isMaxLevel(levelData);
  return (
    <div className={`${styles.badgeStamp} ${compact ? styles.badgeStampCompact : ""} ${max ? styles.badgeStampLegend : ""}`}>
      <span>LV</span>
      <strong>{levelData.levelNumber}</strong>
    </div>
  );
}

function SegmentedTrailBar({
  levelData,
  label = "Explorer level progress",
}: {
  levelData: NormalizedLevelData;
  label?: string;
}) {
  const max = isMaxLevel(levelData);
  const progress = max ? 100 : clampProgress(levelData.levelProgressPercent);
  const activeSegment = Math.min(10, Math.max(1, levelData.levelNumber));
  const completedSegments = max ? 10 : Math.max(0, activeSegment - 1);
  const ariaValue = max ? 100 : Math.round(((completedSegments + progress / 100) / 10) * 100);

  return (
    <div
      className={styles.segmentedTrail}
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={ariaValue}
    >
      {Array.from({ length: 10 }).map((_, index) => {
        const segmentNumber = index + 1;
        const fill = max || segmentNumber <= completedSegments
          ? 100
          : segmentNumber === activeSegment
            ? progress
            : 0;

        return (
          <span key={segmentNumber} className={fill === 100 ? styles.segmentFilled : ""}>
            <i style={{ width: `${fill}%` }} />
          </span>
        );
      })}
    </div>
  );
}

function CompassRing({ levelData }: { levelData: NormalizedLevelData }) {
  const max = isMaxLevel(levelData);
  const progress = max ? 100 : clampProgress(levelData.levelProgressPercent);
  const radius = 46;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (progress / 100) * circumference;

  return (
    <div className={`${styles.compassRing} ${max ? styles.compassRingLegend : ""}`}>
      <svg viewBox="0 0 120 120" role="img" aria-label={`${Math.round(progress)}% progress toward next level`}>
        <circle className={styles.compassRingTrack} cx="60" cy="60" r={radius} />
        <circle
          className={styles.compassRingProgress}
          cx="60"
          cy="60"
          r={radius}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
        <path className={styles.compassNeedle} d="M60 22 68 60 60 98 52 60Z" />
      </svg>
      <strong>{Math.round(progress)}%</strong>
      <span>{max ? "Legend" : "to next"}</span>
    </div>
  );
}

function XpBlock({ levelData }: { levelData: NormalizedLevelData }) {
  const [open, setOpen] = useState(false);
  const max = isMaxLevel(levelData);
  const progress = max ? 100 : clampProgress(levelData.levelProgressPercent);

  return (
    <section className={`${styles.xpBlock} ${max ? styles.xpBlockLegend : ""}`} aria-label="Explorer level">
      <div className={styles.xpBlockTop}>
        <BadgeStamp levelData={levelData} compact />
        <div className={styles.xpBlockTitle}>
          <span>Explorer level</span>
          <strong>{levelData.levelTitle}</strong>
          <TierPill level={levelData.level} max={max} />
        </div>
      </div>

      <SegmentedTrailBar levelData={levelData} label={`Level ${levelData.levelNumber}, ${levelData.levelTitle}`} />

      <div className={styles.xpBlockMeta}>
        <span>{levelData.xp} XP</span>
        <span>{max ? "Untamed Legend - The trail ends here." : `${levelData.xpToNextLevel} XP to next level`}</span>
      </div>

      <button
        type="button"
        className={styles.xpHintButton}
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        How XP works
      </button>

      {open && (
        <p className={styles.xpHintText}>
          Earn XP from paid trips, showing up as present, writing activity and guide reviews, and trying your first category.
          Current segment progress: {Math.round(progress)}%.
        </p>
      )}
    </section>
  );
}

function GuideCredibilityBlock({ credibility }: { credibility: GuideCredibilityData }) {
  const detailParts = [
    credibility.experienceYears != null ? `${credibility.experienceYears} years experience` : null,
    credibility.certificateCount ? `${credibility.certificateCount} certificate${credibility.certificateCount === 1 ? "" : "s"}` : null,
  ].filter(Boolean);

  return (
    <section className={styles.guideCredibilityBlock} aria-label="Guide credibility">
      <div className={styles.guideCredibilityTop}>
        <span className={styles.guideCredibilityIcon}>
          <Icon name="shield" />
        </span>
        <div>
          <span>Professional guide</span>
          <strong>{getGuideRankTitle(credibility)}</strong>
        </div>
      </div>

      <div className={styles.guideCredibilityRows}>
        <p>{credibility.verifiedBadge ? "Verified professional guide" : "Verification pending"}</p>
        <p>{formatGuideRating(credibility)}</p>
        {detailParts.length > 0 && <p>{detailParts.join(" · ")}</p>}
      </div>
    </section>
  );
}

function ExplorerProgressCard({ levelData }: { levelData: NormalizedLevelData }) {
  const max = isMaxLevel(levelData);
  const progress = max ? 100 : clampProgress(levelData.levelProgressPercent);

  return (
    <section className={`${styles.panel} ${styles.explorerProgressCard} ${max ? styles.explorerProgressLegend : ""}`}>
      <div className={styles.explorerProgressMain}>
        <div className={styles.explorerCompassWrap}>
          <CompassRing levelData={levelData} />
          <BadgeStamp levelData={levelData} />
        </div>

        <div className={styles.explorerProgressContent}>
          <span className={styles.eyebrow}>Explorer progress</span>
          <h2>{levelData.levelTitle}</h2>
          <p>
            {max
              ? "Untamed Legend - The trail ends here."
              : `You have ${levelData.xp} XP. ${levelData.xpToNextLevel} XP to ${nextLevelTitle(levelData.levelNumber)}.`}
          </p>
          <TierPill level={levelData.level} max={max} />
          <SegmentedTrailBar levelData={levelData} label="Full explorer trail progress" />
        </div>
      </div>

      <div className={styles.xpRuleStrip}>
        <span>+30 paid booking</span>
        <span>+100 present</span>
        <span>+25 activity review</span>
        <span>+25 guide review</span>
        <span>+40 first category</span>
      </div>

      <div className={styles.explorerStatsGrid}>
        <div>
          <strong>{max ? "Max" : levelData.xpToNextLevel}</strong>
          <span>{max ? "Status" : "XP to go"}</span>
        </div>
        <div>
          <strong>{Math.round(progress)}%</strong>
          <span>Progress</span>
        </div>
        <div>
          <strong>Level {levelData.levelNumber}</strong>
          <span>{formatLevelTier(levelData.level)}</span>
        </div>
      </div>
    </section>
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
  const levelData = getLevelData(user, activityFeed);
  const guideCredibility = getGuideCredibilityData(user, guide);
  const verifiedGuide = isGuide && guideCredibility.verifiedBadge;
  const stats = isGuide
    ? [
        { value: guideCredibility.ratingAverage != null ? guideCredibility.ratingAverage.toFixed(1) : "-", label: "Rating" },
        { value: guideCredibility.ratingCount, label: "Reviews" },
        { value: guideCredibility.experienceYears ?? guideCredibility.certificateCount, label: guideCredibility.experienceYears != null ? "Years" : "Certs" },
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
      </div>

      <div className={styles.identity}>
        <h1>{displayName}</h1>
        <p>{roleLabel}</p>
        <div className={styles.identityPills}>
          <span className={`${styles.rolePill} ${isGuide ? styles.rolePillGuide : ""}`}>
            {isGuide && <Icon name="shield" />}
            {roleLabel}
          </span>
          {verifiedGuide && <span className={styles.verifiedTextPill}>Professional guide verified</span>}
        </div>
      </div>

      {isGuide ? (
        <GuideCredibilityBlock credibility={guideCredibility} />
      ) : (
        <XpBlock levelData={levelData} />
      )}

      <div className={styles.profileStats}>
        {stats.map((stat) => (
          <div key={stat.label}>
            <strong>{stat.value}</strong>
            <span>{stat.label}</span>
          </div>
        ))}
      </div>

      <div className={styles.profileActions}>
        <Link to="/profile/edit" className={styles.editProfileButton}>
          Edit profile
        </Link>
        {user.id && (
          <Link to={`/users/${user.id}`} className={styles.publicProfileButton}>
            <Icon name="eye" />
            View public profile
          </Link>
        )}
      </div>
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

function PersonalInfoGrid({
  user,
  activityFeed,
  isGuide,
  guide,
}: {
  user: AuthUser;
  activityFeed: ProfileActivityFeed | null;
  isGuide: boolean;
  guide: GuideProfileResponse | null;
}) {
  const levelData = getLevelData(user, activityFeed);
  const guideCredibility = getGuideCredibilityData(user, guide);
  const adventurerItems = [
    { icon: "mail" as const, label: "Email", value: user.email },
    { icon: "phone" as const, label: "Phone", value: user.phoneNumber },
    { icon: "compass" as const, label: "Level", value: `Level ${levelData.levelNumber} \u00b7 ${levelData.levelTitle}` },
    { icon: "award" as const, label: "XP", value: `${levelData.xp} XP \u00b7 ${formatLevelTier(levelData.level)}` },
    { icon: "map" as const, label: "Member since", value: formatMemberSince(user.createdAt) },
  ];
  const guideItems = [
    { icon: "mail" as const, label: "Email", value: user.email },
    { icon: "phone" as const, label: "Phone", value: user.phoneNumber },
    {
      icon: "shield" as const,
      label: "Guide status",
      value: guideCredibility.verifiedBadge ? "Verified professional guide" : "Professional guide",
    },
    {
      icon: "star" as const,
      label: "Guide rating",
      value: guideCredibility.ratingCount > 0 && guideCredibility.ratingAverage !== null
        ? `${guideCredibility.ratingAverage.toFixed(1)} \u00b7 ${guideCredibility.ratingCount} reviews`
        : "Building guide reputation",
    },
    { icon: "map" as const, label: "Member since", value: formatMemberSince(user.createdAt) },
  ];
  const items = (isGuide ? guideItems : adventurerItems).filter((item) => item.value);

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

function GuidePublicTrustCard({ credibility }: { credibility: GuideCredibilityData }) {
  return (
    <section className={`${styles.panel} ${styles.guideTrustCard}`}>
      <div className={styles.guideTrustIcon}>
        <Icon name="shield" />
      </div>
      <div>
        <span className={styles.eyebrow}>Guide trust</span>
        <h2>{getGuideRankTitle(credibility)}</h2>
        <p>{credibility.verifiedBadge ? "Verified professional guide" : "Verification pending"}</p>
        <div className={styles.guideTrustFacts}>
          <span>{formatGuideRating(credibility)}</span>
          {credibility.experienceYears != null ? <span>{credibility.experienceYears} years experience</span> : null}
          {credibility.certificateCount ? <span>{credibility.certificateCount} certificate{credibility.certificateCount === 1 ? "" : "s"}</span> : null}
          {credibility.verifiedBadge ? <span>Verified badge</span> : null}
        </div>
      </div>
    </section>
  );
}

function AboutTab({
  user,
  topCategories,
  activityFeed,
  isGuide,
  guide,
}: {
  user: AuthUser;
  topCategories: TasteCategory[];
  activityFeed: ProfileActivityFeed | null;
  isGuide: boolean;
  guide: GuideProfileResponse | null;
}) {
  const levelData = getLevelData(user, activityFeed);
  const guideCredibility = getGuideCredibilityData(user, guide);

  return (
    <div className={styles.tabPanel}>
      {!isGuide && <ExplorerProgressCard levelData={levelData} />}
      {isGuide && <GuidePublicTrustCard credibility={guideCredibility} />}

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
        <PersonalInfoGrid user={user} activityFeed={activityFeed} isGuide={isGuide} guide={guide} />
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
  verifiedGuide,
  guideReviews,
  guideReviewsLoading,
  guideReviewsLoadingMore,
  guideReviewsError,
  onLoadMoreGuideReviews,
  loading,
  error,
}: {
  guide: GuideProfileResponse | null;
  verifiedGuide: boolean;
  guideReviews: PaginatedResponse<GuideReview> | null;
  guideReviewsLoading: boolean;
  guideReviewsLoadingMore: boolean;
  guideReviewsError: string | null;
  onLoadMoreGuideReviews: () => void;
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
          <h2>{verifiedGuide ? "Verified Professional Guide" : "Guide profile"}</h2>
          <p>
            {guide?.ratingSummary?.count
              ? `${guide.ratingSummary.average.toFixed(1)} average rating across ${guide.ratingSummary.count} reviews.`
              : "Building guide reputation."}
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

      <section className={styles.panel}>
        <div className={styles.panelHeader}>
          <span className={styles.eyebrow}>Guide reviews</span>
          <h2>What adventurers say</h2>
        </div>

        <div className={styles.guideReviewSummary}>
          <strong>{guide?.ratingSummary?.average ?? "-"}</strong>
          <span>{guide?.ratingSummary?.count ?? 0} guide review{guide?.ratingSummary?.count === 1 ? "" : "s"}</span>
        </div>

        {guideReviewsLoading ? (
          <div className={styles.guideReviewSkeleton} aria-hidden="true" />
        ) : guideReviewsError ? (
          <div className={styles.errorState}>{guideReviewsError}</div>
        ) : !guideReviews?.content.length ? (
          <p className={styles.softEmpty}>No guide reviews yet. They will appear after adventurers complete trips with this guide.</p>
        ) : (
          <div className={styles.guideReviewList}>
            {guideReviews.content.map((review) => (
              <article key={review.id} className={styles.guideReviewCard}>
                {review.reviewer?.id ? (
                  <Link
                    to={`/users/${review.reviewer.id}`}
                    className={styles.guideReviewAvatar}
                    aria-label={`View ${review.reviewer?.username || "adventurer"}'s public profile`}
                  >
                    {review.reviewer?.profileImageUrl ? (
                      <img src={review.reviewer.profileImageUrl} alt={review.reviewer.username} />
                    ) : (
                      <span>{review.reviewer?.username?.slice(0, 1).toUpperCase() || "A"}</span>
                    )}
                  </Link>
                ) : (
                  <div className={styles.guideReviewAvatar} aria-hidden="true">
                    <span>{review.reviewer?.username?.slice(0, 1).toUpperCase() || "A"}</span>
                  </div>
                )}
                <div>
                  <div className={styles.guideReviewTopline}>
                    {review.reviewer?.id ? (
                      <Link to={`/users/${review.reviewer.id}`} className={styles.guideReviewProfileLink}>
                        {review.reviewer?.username || "Adventurer"}
                      </Link>
                    ) : (
                      <strong>{review.reviewer?.username || "Adventurer"}</strong>
                    )}
                    <span aria-label={`${review.rating} out of 5 stars`}>
                      {"\u2605".repeat(review.rating)}
                      {"\u2606".repeat(Math.max(0, 5 - review.rating))}
                    </span>
                  </div>
                  <p>{review.comment}</p>
                  <small>{formatShortDate(review.createdAt)}</small>
                </div>
              </article>
            ))}
          </div>
        )}

        {guideReviews && !guideReviews.last && (
          <button
            type="button"
            className={styles.loadMoreReviewsButton}
            onClick={onLoadMoreGuideReviews}
            disabled={guideReviewsLoadingMore}
          >
            {guideReviewsLoadingMore ? "Loading guide reviews..." : "Load more guide reviews"}
          </button>
        )}
      </section>

      <Link to="/profile/guide/edit" className={styles.secondaryAction}>
        Edit guide profile
      </Link>
    </div>
  );
}


function GuideReviewsTab({
  guideReviews,
  guideReviewsLoading,
  guideReviewsLoadingMore,
  guideReviewsError,
  onLoadMoreGuideReviews,
}: {
  guideReviews: PaginatedResponse<GuideReview> | null;
  guideReviewsLoading: boolean;
  guideReviewsLoadingMore: boolean;
  guideReviewsError: string | null;
  onLoadMoreGuideReviews: () => void;
}) {
  if (guideReviewsLoading) {
    return (
      <div className={styles.tabPanel}>
        <div className={styles.panelSkeleton} aria-hidden="true" />
        <div className={styles.panelSkeleton} aria-hidden="true" />
      </div>
    );
  }

  if (guideReviewsError) {
    return <div className={styles.errorState}>{guideReviewsError}</div>;
  }

  if (!guideReviews?.content.length) {
    return (
      <div className={styles.tabPanel}>
        <section className={styles.panel}>
          <div className={styles.emptyFingerprint}>
            <Icon name="star" />
            <p>No guide reviews yet. They will appear after adventurers complete trips with you.</p>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className={styles.tabPanel}>
      <section className={styles.panel}>
        <div className={styles.panelHeader}>
          <span className={styles.eyebrow}>Guide reviews</span>
          <h2>Reviews you received</h2>
        </div>

        <div className={styles.guideReviewList}>
          {guideReviews.content.map((review) => (
            <article key={review.id} className={styles.guideReviewCard}>
              {review.reviewer?.id ? (
                <Link
                  to={`/users/${review.reviewer.id}`}
                  className={styles.guideReviewAvatar}
                  aria-label={`View ${review.reviewer?.username || "adventurer"}'s public profile`}
                >
                  {review.reviewer?.profileImageUrl ? (
                    <img src={review.reviewer.profileImageUrl} alt={review.reviewer.username} />
                  ) : (
                    <span>{review.reviewer?.username?.slice(0, 1).toUpperCase() || "A"}</span>
                  )}
                </Link>
              ) : (
                <div className={styles.guideReviewAvatar} aria-hidden="true">
                  <span>{review.reviewer?.username?.slice(0, 1).toUpperCase() || "A"}</span>
                </div>
              )}

              <div>
                <div className={styles.guideReviewTopline}>
                  {review.reviewer?.id ? (
                    <Link to={`/users/${review.reviewer.id}`} className={styles.guideReviewProfileLink}>
                      {review.reviewer?.username || "Adventurer"}
                    </Link>
                  ) : (
                    <strong>{review.reviewer?.username || "Adventurer"}</strong>
                  )}
                  <span aria-label={`${review.rating} out of 5 stars`}>
                    {"\u2605".repeat(review.rating)}
                    {"\u2606".repeat(Math.max(0, 5 - review.rating))}
                  </span>
                </div>

                <p>{review.comment}</p>
                <small>{formatShortDate(review.createdAt)}</small>
              </div>
            </article>
          ))}
        </div>

        {!guideReviews.last && (
          <button
            type="button"
            className={styles.loadMoreReviewsButton}
            onClick={onLoadMoreGuideReviews}
            disabled={guideReviewsLoadingMore}
          >
            {guideReviewsLoadingMore ? "Loading guide reviews..." : "Load more guide reviews"}
          </button>
        )}
      </section>
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
  const [guideReviews, setGuideReviews] = useState<PaginatedResponse<GuideReview> | null>(null);
  const [guideReviewsLoading, setGuideReviewsLoading] = useState(false);
  const [guideReviewsLoadingMore, setGuideReviewsLoadingMore] = useState(false);
  const [guideReviewsError, setGuideReviewsError] = useState<string | null>(null);

  const isGuide = user?.role === "GUIDE";
  const verifiedGuide = isGuide && (user?.guideProfile?.verifiedBadge === true || guide?.verifiedBadge === true);
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

  useEffect(() => {
    if (!isGuide || !user?.id || (activeTab !== "guide" && activeTab !== "reviews")) return;
    if (guideReviews) return;

    let alive = true;

    async function loadGuideReviews() {
      setGuideReviewsLoading(true);
      setGuideReviewsError(null);

      try {
        const reviews = await GuideReviewApi.listGuideReviews(
          user!.id,
          0,
          GUIDE_REVIEWS_PAGE_SIZE
        );

        if (!alive) return;
        setGuideReviews(reviews);
      } catch (e: any) {
        if (!alive) return;
        setGuideReviewsError(e?.message ?? "Failed to load guide reviews");
      } finally {
        if (alive) setGuideReviewsLoading(false);
      }
    }

    loadGuideReviews();

    return () => {
      alive = false;
    };
  }, [activeTab, guideReviews, isGuide, user?.id]);

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

  const handleLoadMoreGuideReviews = async () => {
    if (!user?.id || !guideReviews || guideReviews.last || guideReviewsLoadingMore) return;

    setGuideReviewsLoadingMore(true);
    setGuideReviewsError(null);
    try {
      const next = await GuideReviewApi.listGuideReviews(
        user.id,
        guideReviews.page + 1,
        GUIDE_REVIEWS_PAGE_SIZE
      );

      setGuideReviews((prev) => {
        if (!prev) return next;
        return {
          ...next,
          content: [...prev.content, ...next.content],
        };
      });
    } catch (e: any) {
      setGuideReviewsError(e?.message ?? "Failed to load more guide reviews");
    } finally {
      setGuideReviewsLoadingMore(false);
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
              {activeTab === "about" && (
                <AboutTab
                  user={user}
                  topCategories={topCategories}
                  activityFeed={activityFeed}
                  isGuide={isGuide}
                  guide={guide}
                />
              )}

              {activeTab === "guide" && isGuide && (
                <GuideExperienceTab
                  guide={guide}
                  verifiedGuide={Boolean(verifiedGuide)}
                  guideReviews={guideReviews}
                  guideReviewsLoading={guideReviewsLoading}
                  guideReviewsLoadingMore={guideReviewsLoadingMore}
                  guideReviewsError={guideReviewsError}
                  onLoadMoreGuideReviews={handleLoadMoreGuideReviews}
                  loading={guideLoading}
                  error={guideErr}
                />
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

              {activeTab === "reviews" &&
                (isGuide ? (
                  <GuideReviewsTab
                    guideReviews={guideReviews}
                    guideReviewsLoading={guideReviewsLoading}
                    guideReviewsLoadingMore={guideReviewsLoadingMore}
                    guideReviewsError={guideReviewsError}
                    onLoadMoreGuideReviews={handleLoadMoreGuideReviews}
                  />
                ) : (
                  <ReviewTab
                    reviews={activityFeed?.reviews ?? null}
                    loading={activityFeedLoading}
                    loadingMore={loadingMoreReviews}
                    error={activityFeedError}
                    onLoadMore={handleLoadMoreReviews}
                  />
                ))}
            </div>
          </section>
        </div>
      </main>
    </>
  );
}

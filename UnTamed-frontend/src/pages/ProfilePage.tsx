import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../auth/auth.store";
import * as GuideApi from "../api/guide.api";
import type { GuideProfileResponse } from "../api/guide.api";
import * as BookingApi from "../api/booking.api";
import * as ActivityApi from "../api/activity.api";
import * as CategoryApi from "../api/category.api";
import type { Category } from "../types/category";
import styles from "../style/ProfilePage.module.css";
import { Header } from "../components/Header";
import { ActivityTab } from "../components/ActivityTab";
import { TopCategories } from "../components/TopCategories";

type TabType = "about" | "guide" | "activity" | "posts";

type TopCategory = {
  id: string;
  name: string;
  count: number;
  iconUrl?: string;
};

// ─── Icons ───────────────────────────────────────────────────────────────────

function BackIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 12H5M12 5l-7 7 7 7" />
    </svg>
  );
}

function PhoneIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
    </svg>
  );
}

function MailIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
    </svg>
  );
}

function LevelIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M13 10V3L4 14h7v7l9-11h-7z" />
    </svg>
  );
}

function VerifiedIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor">
      <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

// ─── Component ───────────────────────────────────────────────────────────────

export function ProfilePage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [guide, setGuide] = useState<GuideProfileResponse | null>(null);
  const [guideLoading, setGuideLoading] = useState(false);
  const [guideErr, setGuideErr] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>("about");
  const [topCategories, setTopCategories] = useState<TopCategory[]>([]);
  const [isScrolled, setIsScrolled] = useState(false);

  // Refs for scroll-spy sections
  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const contentRef = useRef<HTMLDivElement | null>(null);
  const scrollSpyEnabled = useRef(false);

  const isGuide = user?.role === "GUIDE";

  const tabs: { id: TabType; label: string }[] = [
    { id: "about", label: "About" },
    ...(isGuide ? [{ id: "guide" as TabType, label: "Experience" }] : []),
    { id: "activity", label: "Activity" },
    { id: "posts", label: "Posts" },
  ];

  // ── Hash sync ──────────────────────────────────────────────────────────────
  useEffect(() => {
    const hash = location.hash.replace("#", "") as TabType;
    if (hash && tabs.some((t) => t.id === hash)) {
      setActiveTab(hash);
    }
  }, [location.hash]);

  // ── Header shadow on scroll ────────────────────────────────────────────────
  useEffect(() => {
    const onScroll = () => setIsScrolled(window.scrollY > 10);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // ── Scroll-spy ────────────────────────────────────────────────────────────
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (!scrollSpyEnabled.current) return;
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const id = entry.target.getAttribute("data-section") as TabType;
            if (id) {
              setActiveTab(id);
              window.history.replaceState(null, "", `#${id}`);
            }
          }
        });
      },
      { rootMargin: "-40% 0px -55% 0px", threshold: 0 }
    );

    Object.values(sectionRefs.current).forEach((el) => el && observer.observe(el));
    return () => observer.disconnect();
  }, [isGuide]);

  // Enable scroll-spy after a short delay to avoid fighting with programmatic scrolls
  useEffect(() => {
    const t = setTimeout(() => { scrollSpyEnabled.current = true; }, 600);
    return () => clearTimeout(t);
  }, []);

  // ── Guide profile ──────────────────────────────────────────────────────────
  useEffect(() => {
    let alive = true;
    async function loadGuide() {
      if (!isGuide) { setGuide(null); return; }
      setGuideLoading(true);
      setGuideErr(null);
      try {
        const gp = await GuideApi.getGuideMe();
        if (alive) setGuide(gp);
      } catch (e: any) {
        if (alive) setGuideErr(e?.message ?? "Failed to load guide profile");
      } finally {
        if (alive) setGuideLoading(false);
      }
    }
    loadGuide();
    return () => { alive = false; };
  }, [isGuide]);

  // ── Top categories ─────────────────────────────────────────────────────────
  useEffect(() => {
    let alive = true;

    function extractCategoryIds(templateLike: any): string[] {
      if (!templateLike) return [];
      if (Array.isArray(templateLike.categoryIds) && templateLike.categoryIds.length > 0)
        return templateLike.categoryIds.filter((id: unknown): id is string => typeof id === "string");
      if (Array.isArray(templateLike.categories) && templateLike.categories.length > 0)
        return templateLike.categories.map((c: any) => (typeof c === "string" ? c : c?.id)).filter((id: unknown): id is string => typeof id === "string" && id.length > 0);
      if (typeof templateLike.categoryId === "string" && templateLike.categoryId.length > 0)
        return [templateLike.categoryId];
      if (Array.isArray(templateLike.tags) && templateLike.tags.length > 0)
        return templateLike.tags.filter((id: unknown): id is string => typeof id === "string");
      return [];
    }

    async function computeCategories() {
      try {
        const [bookings, categories] = await Promise.all([
          BookingApi.listMyBookings(),
          CategoryApi.listCategories({ activeOnly: true }),
        ]);
        const validBookings = bookings.filter(
          (b: BookingApi.Booking) => b.status === "COMPLETED" || (b.status as string) === "CONFIRMED"
        );
        const templateLikes = await Promise.all(
          validBookings.map(async (b: BookingApi.Booking) => {
            try {
              const session = await ActivityApi.getSessionById(b.sessionId);
              if ((session as any).template) return (session as any).template;
              const templateId = (session as any).templateId || (session as any).activityTemplateId;
              if (!templateId) return null;
              return await ActivityApi.getPublicTemplateById(templateId);
            } catch { return null; }
          })
        );
        const counter = new Map<string, number>();
        templateLikes.forEach((tl: any) => {
          if (!tl) return;
          extractCategoryIds(tl).forEach((id: string) => counter.set(id, (counter.get(id) ?? 0) + 1));
        });
        const result: TopCategory[] = categories
          .map((c: Category) => ({ id: c.id, name: c.name, count: counter.get(c.id) ?? 0, iconUrl: c.iconUrl ?? undefined }))
          .filter((c: TopCategory) => c.count > 0)
          .sort((a: TopCategory, b: TopCategory) => b.count - a.count)
          .slice(0, 5);
        if (alive) setTopCategories(result);
      } catch { if (alive) setTopCategories([]); }
    }

    computeCategories();
    return () => { alive = false; };
  }, []);

  // ── Tab click → smooth scroll ─────────────────────────────────────────────
  const handleTabChange = (tab: TabType) => {
    scrollSpyEnabled.current = false;
    setActiveTab(tab);
    navigate(`#${tab}`, { replace: true });

    const el = sectionRefs.current[tab];
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }

    // Re-enable scroll-spy after scroll animation completes
    setTimeout(() => { scrollSpyEnabled.current = true; }, 800);
  };

  const displayName = useMemo(() => {
    if (!user) return "";
    return user.username || user.email || "User";
  }, [user]);

  if (loading) return <div className={styles.loading}>Loading…</div>;
  if (!user) return <div className={styles.loading}>Not authenticated</div>;

  return (
    <>
      <Header />

      <div className={styles.pageWrapper}>
        {/* ── Sticky header ─────────────────────────────────────────────── */}
        <div className={`${styles.fixedHeader} ${isScrolled ? styles.fixedHeaderScrolled : ""}`}>
          <div className={styles.headerContainer}>

            {/* Profile card */}
            <div className={styles.profileCard}>
              {/* Back button */}
              <button
                className={styles.backButton}
                onClick={() => navigate(-1)}
                aria-label="Go back"
              >
                <BackIcon />
              </button>

              {/* Avatar */}
              <div className={styles.avatarSection}>
                {user.profileImageUrl ? (
                  <img src={user.profileImageUrl} alt={displayName} className={styles.avatar} />
                ) : (
                  <div className={styles.avatarPlaceholder}>
                    {displayName.slice(0, 1).toUpperCase()}
                  </div>
                )}
                {user.role === "GUIDE" && user.verified && (
                  <div className={styles.verifiedIcon}>
                    <VerifiedIcon />
                  </div>
                )}
              </div>

              {/* Name + role */}
              <div className={styles.profileInfo}>
                <h1 className={styles.userName}>{displayName}</h1>
                <p className={styles.userRole}>{user.role}</p>
              </div>

              {/* Stats */}
              <div className={styles.statsGrid}>
                {isGuide && guide ? (
                  <>
                    <div className={styles.statItem}>
                      <div className={styles.statValue}>{guide.ratingSummary ? guide.ratingSummary.average : "—"}</div>
                      <div className={styles.statLabel}>Rating</div>
                    </div>
                    <div className={styles.statItem}>
                      <div className={styles.statValue}>{guide.ratingSummary?.count || 0}</div>
                      <div className={styles.statLabel}>Reviews</div>
                    </div>
                    <div className={styles.statItem}>
                      <div className={styles.statValue}>{guide.experienceYears ?? 0}</div>
                      <div className={styles.statLabel}>Exp. years</div>
                    </div>
                    <div className={styles.statItem}>
                      <div className={styles.statValue}>{guide.certificates?.length || 0}</div>
                      <div className={styles.statLabel}>Certs</div>
                    </div>
                  </>
                ) : (
                  <>
                    <div className={styles.statItem}>
                      <div className={styles.statValue}>{user.confirmedTripsCount ?? 0}</div>
                      <div className={styles.statLabel}>Trips</div>
                    </div>
                    <div className={styles.statItem}>
                      <div className={styles.statValue}>{user.reviewsWrittenCount ?? 0}</div>
                      <div className={styles.statLabel}>Reviews</div>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* ── Tab nav ─────────────────────────────────────────────────── */}
            <nav className={styles.tabsNav} role="tablist">
              {tabs.map((t) => (
                <button
                  key={t.id}
                  role="tab"
                  aria-selected={activeTab === t.id}
                  className={`${styles.tab} ${activeTab === t.id ? styles.tabActive : ""}`}
                  onClick={() => handleTabChange(t.id)}
                >
                  {t.label}
                  {activeTab === t.id && <span className={styles.tabUnderline} />}
                </button>
              ))}
            </nav>
          </div>
        </div>

        {/* ── Scrollable content ────────────────────────────────────────── */}
        <div className={styles.contentWrapper} ref={contentRef}>
          <div className={styles.contentContainer}>

            {/* ABOUT ─────────────────────────────────────────────────────── */}
            <div
              ref={(el) => { sectionRefs.current["about"] = el; }}
              data-section="about"
              className={styles.section}
            >
              <div className={styles.tabContent}>
                <div className={styles.sectionHeader}>
                  <h2 className={styles.sectionTitle}>About Me</h2>
                  <Link
                    to="/profile/edit"
                    state={{ from: `${location.pathname}${location.hash}` }}
                    className={styles.editButton}
                  >
                    Edit profile
                  </Link>
                </div>

                <div className={styles.subsection}>
                  <h3 className={styles.subsectionTitle}>Bio</h3>
                  <p className={styles.bioText}>
                    {user.bio || "Add a bio to help people get to know you better. Share your story, passions, and what makes you unique."}
                  </p>
                </div>

                {/* Compact info badges ─────────────────────────────────── */}
                <div className={styles.subsection}>
                  <h3 className={styles.subsectionTitle}>Personal Information</h3>
                  <div className={styles.infoBadgeRow}>
                    <div className={styles.infoBadge}>
                      <span className={styles.infoBadgeIcon}><PhoneIcon /></span>
                      <div className={styles.infoBadgeText}>
                        <span className={styles.infoBadgeLabel}>Phone</span>
                        <span className={styles.infoBadgeValue}>{user.phoneNumber || "Not provided"}</span>
                      </div>
                    </div>

                    <div className={styles.infoBadge}>
                      <span className={styles.infoBadgeIcon}><MailIcon /></span>
                      <div className={styles.infoBadgeText}>
                        <span className={styles.infoBadgeLabel}>Email</span>
                        <span className={styles.infoBadgeValue}>{user.email}</span>
                      </div>
                    </div>

                    <div className={styles.infoBadge}>
                      <span className={styles.infoBadgeIcon}><LevelIcon /></span>
                      <div className={styles.infoBadgeText}>
                        <span className={styles.infoBadgeLabel}>Level</span>
                        <span className={styles.infoBadgeValue}>{user.level || "Not specified"}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {user.preferences && user.preferences.length > 0 && (
                  <div className={styles.subsection}>
                    <h3 className={styles.subsectionTitle}>Interests & Preferences</h3>
                    <div className={styles.tagContainer}>
                      {user.preferences.map((p) => (
                        <span key={p} className={styles.tag}>{p}</span>
                      ))}
                    </div>
                  </div>
                )}

                <TopCategories topCategories={topCategories} />
              </div>
            </div>

            {/* GUIDE EXPERIENCE ───────────────────────────────────────────── */}
            {isGuide && (
              <div
                ref={(el) => { sectionRefs.current["guide"] = el; }}
                data-section="guide"
                className={styles.section}
              >
                <div className={styles.tabContent}>
                  <div className={styles.sectionHeader}>
                    <h2 className={styles.sectionTitle}>Guide Profile</h2>
                    <Link
                      to="/profile/guide/edit"
                      state={{ from: `${location.pathname}${location.hash}` }}
                      className={styles.editButton}
                    >
                      Edit profile
                    </Link>
                  </div>

                  {guideLoading ? (
                    <div className={styles.loadingText}>Loading guide profile…</div>
                  ) : guideErr ? (
                    <div className={styles.errorText}>{guideErr}</div>
                  ) : (
                    <>
                      <div className={styles.subsection}>
                        <h3 className={styles.subsectionTitle}>Professional Experience</h3>
                        <div className={styles.experienceCard}>
                          <div className={styles.experienceIcon}>
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                            </svg>
                          </div>
                          <div>
                            <div className={styles.experienceYears}>
                              {guide?.experienceYears != null ? `${guide.experienceYears} years` : "Not specified"}
                            </div>
                            <div className={styles.experienceSubtext}>
                              {guide?.experienceYears
                                ? `Guiding since ${new Date().getFullYear() - guide.experienceYears}`
                                : "of professional guiding experience"}
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className={styles.subsection}>
                        <h3 className={styles.subsectionTitle}>Ratings & Reviews</h3>
                        <div className={styles.ratingCard}>
                          <div className={styles.ratingStars}>
                            {guide?.ratingSummary ? (
                              <>
                                <span className={styles.ratingValue}>★ {guide.ratingSummary.average}</span>
                                <span className={styles.ratingCount}>({guide.ratingSummary.count} reviews)</span>
                              </>
                            ) : (
                              <span className={styles.ratingEmpty}>No ratings yet</span>
                            )}
                          </div>
                        </div>
                      </div>

                      {guide?.certificates && guide.certificates.length > 0 && (
                        <div className={styles.subsection}>
                          <h3 className={styles.subsectionTitle}>Certifications</h3>
                          <div className={styles.certificateList}>
                            {guide.certificates.map((c) => (
                              <div key={c.id} className={styles.certificateItem}>
                                <div className={styles.certificateBadge}>
                                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                                  </svg>
                                </div>
                                <div className={styles.certificateContent}>
                                  <div className={styles.certificateName}>{c.title}</div>
                                  <div className={styles.certificateIssuer}>{c.issuer}</div>
                                  {c.credentialId && <div className={styles.certificateId}>ID: {c.credentialId}</div>}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            )}

            {/* ACTIVITY ───────────────────────────────────────────────────── */}
            <div
              ref={(el) => { sectionRefs.current["activity"] = el; }}
              data-section="activity"
              className={styles.section}
            >
              <div className={styles.tabContent}>
                <div className={styles.sectionHeader}>
                  <h2 className={styles.sectionTitle}>Activity</h2>
                </div>
                <ActivityTab />
              </div>
            </div>

            {/* POSTS ──────────────────────────────────────────────────────── */}
            <div
              ref={(el) => { sectionRefs.current["posts"] = el; }}
              data-section="posts"
              className={styles.section}
            >
              <div className={styles.tabContent}>
                <div className={styles.comingSoon}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
                  </svg>
                  <h3>Posts coming soon</h3>
                  <p>Share your adventures and stories with the community.</p>
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>
    </>
  );
}
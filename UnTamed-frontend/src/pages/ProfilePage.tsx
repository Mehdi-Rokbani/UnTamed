import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../auth/auth.store";
import * as GuideApi from "../api/guide.api";
import type { GuideProfileResponse } from "../api/guide.api";
import styles from "../style/ProfilePage.module.css";
import { Header } from "../components/Header";
import { ActivityTab } from "../components/ActivityTab";

type TabType = "about" | "guide" | "activity" | "posts";

export function ProfilePage() {
  const { user, loading } = useAuth();
  const [guide, setGuide] = useState<GuideProfileResponse | null>(null);
  const [guideLoading, setGuideLoading] = useState(false);
  const [guideErr, setGuideErr] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>("about");

  const location = useLocation();
  const navigate = useNavigate();

  const isGuide = user?.role === "GUIDE";

  // Sync active tab from URL hash
  useEffect(() => {
    const hash = location.hash.replace("#", "") as TabType;
    if (hash && ["about", "guide", "activity", "posts"].includes(hash)) {
      setActiveTab(hash);
    }
  }, [location.hash]);

  // Load guide profile if applicable
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
        const gp = await GuideApi.getGuideMe();
        if (alive) setGuide(gp);
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

  const displayName = useMemo(() => {
    if (!user) return "";
    return user.username || user.email || "User";
  }, [user]);

  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
    navigate(`#${tab}`);
  };

  if (loading) return <div className={styles.loading}>Loading…</div>;
  if (!user) return <div className={styles.loading}>Not authenticated</div>;

  return (
    <>
      <Header />

      <div className={styles.pageWrapper}>
        {/* ── Fixed top section ──────────────────────────────────────── */}
        <div className={styles.fixedHeader}>
          <div className={styles.headerContainer}>

            {/* Profile card */}
            <div className={styles.profileCard}>
              <div className={styles.avatarSection}>
                {user.profileImageUrl ? (
                  <img
                    src={user.profileImageUrl}
                    alt={displayName}
                    className={styles.avatar}
                  />
                ) : (
                  <div className={styles.avatarPlaceholder}>
                    {displayName.slice(0, 1).toUpperCase()}
                  </div>
                )}
                {user.role === "GUIDE" && user.verified && (
                  <div className={styles.verifiedIcon}>
                    <svg viewBox="0 0 24 24" fill="currentColor">
                      <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                )}
              </div>

              <div className={styles.profileInfo}>
                <h1 className={styles.userName}>{displayName}</h1>
                <p className={styles.userRole}>{user.role}</p>
              </div>

              {/* Stats */}
              <div className={styles.statsGrid}>
                {isGuide && guide ? (
                  <>
                    <div className={styles.statItem}>
                      <div className={styles.statValue}>
                        {guide.ratingSummary ? guide.ratingSummary.average : "—"}
                      </div>
                      <div className={styles.statLabel}>Rating</div>
                    </div>
                    <div className={styles.statItem}>
                      <div className={styles.statValue}>
                        {guide.ratingSummary?.count || 0}
                      </div>
                      <div className={styles.statLabel}>Reviews</div>
                    </div>
                    <div className={styles.statItem}>
                      <div className={styles.statValue}>
                        {guide.experienceYears ?? 0}
                      </div>
                      <div className={styles.statLabel}>Exp. years</div>
                    </div>
                    <div className={styles.statItem}>
                      <div className={styles.statValue}>
                        {guide.certificates?.length || 0}
                      </div>
                      <div className={styles.statLabel}>Certifications</div>
                    </div>
                  </>
                ) : (
                  <>
                    <div className={styles.statItem}>
                      <div className={styles.statValue}>
                        {user.confirmedTripsCount ?? 0}
                      </div>
                      <div className={styles.statLabel}>Trips</div>
                    </div>
                    <div className={styles.statItem}>
                      <div className={styles.statValue}>
                        {user.reviewsWrittenCount ?? 0}
                      </div>
                      <div className={styles.statLabel}>Reviews</div>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Tab navigation */}
            <nav className={styles.tabsNav}>
              <button
                className={`${styles.tab} ${activeTab === "about" ? styles.tabActive : ""}`}
                onClick={() => handleTabChange("about")}
              >
                About
              </button>

              {isGuide && (
                <button
                  className={`${styles.tab} ${activeTab === "guide" ? styles.tabActive : ""}`}
                  onClick={() => handleTabChange("guide")}
                >
                  Experience
                </button>
              )}

              <button
                className={`${styles.tab} ${activeTab === "activity" ? styles.tabActive : ""}`}
                onClick={() => handleTabChange("activity")}
              >
                Activity
              </button>

              <button
                className={`${styles.tab} ${activeTab === "posts" ? styles.tabActive : ""}`}
                onClick={() => handleTabChange("posts")}
              >
                Posts
              </button>
            </nav>
          </div>
        </div>

        {/* ── Dynamic content section ────────────────────────────────── */}
        <div className={styles.contentWrapper}>
          <div className={styles.contentContainer}>

            {/* About tab */}
            {activeTab === "about" && (
              <div className={styles.tabContent}>
                <div className={styles.sectionHeader}>
                  <h2 className={styles.sectionTitle}>About Me</h2>
                  <Link to="/profile/edit" className={styles.editButton}>
                    Edit profile
                  </Link>
                </div>

                <div className={styles.section}>
                  <h3 className={styles.subsectionTitle}>Bio</h3>
                  <p className={styles.bioText}>
                    {user.bio ||
                      "Add a bio to help people get to know you better. Share your story, passions, and what makes you unique."}
                  </p>
                </div>

                <div className={styles.section}>
                  <h3 className={styles.subsectionTitle}>Personal Information</h3>
                  <div className={styles.infoList}>
                    <div className={styles.infoRow}>
                      <svg className={styles.infoIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                      </svg>
                      <div>
                        <div className={styles.infoLabel}>Phone Number</div>
                        <div className={styles.infoValue}>{user.phoneNumber || "Not provided"}</div>
                      </div>
                    </div>

                    <div className={styles.infoRow}>
                      <svg className={styles.infoIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                      <div>
                        <div className={styles.infoLabel}>Email</div>
                        <div className={styles.infoValue}>{user.email}</div>
                      </div>
                    </div>

                    <div className={styles.infoRow}>
                      <svg className={styles.infoIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                      <div>
                        <div className={styles.infoLabel}>Experience Level</div>
                        <div className={styles.infoValue}>{user.level || "Not specified"}</div>
                      </div>
                    </div>
                  </div>
                </div>

                {user.preferences && user.preferences.length > 0 && (
                  <div className={styles.section}>
                    <h3 className={styles.subsectionTitle}>Interests & Preferences</h3>
                    <div className={styles.tagContainer}>
                      {user.preferences.map((p) => (
                        <span key={p} className={styles.tag}>
                          {p}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Guide profile tab */}
            {activeTab === "guide" && isGuide && (
              <div className={styles.tabContent}>
                <div className={styles.sectionHeader}>
                  <h2 className={styles.sectionTitle}>Guide Profile</h2>
                  <Link to="/profile/guide/edit" className={styles.editButton}>
                    Edit profile
                  </Link>
                </div>

                {guideLoading ? (
                  <div className={styles.loadingText}>Loading guide profile…</div>
                ) : guideErr ? (
                  <div className={styles.errorText}>{guideErr}</div>
                ) : (
                  <>
                    <div className={styles.section}>
                      <h3 className={styles.subsectionTitle}>Professional Experience</h3>
                      <div className={styles.experienceCard}>
                        <div className={styles.experienceIcon}>
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                          </svg>
                        </div>
                        <div>
                          <div className={styles.experienceYears}>
                            {guide?.experienceYears != null
                              ? `${guide.experienceYears} years`
                              : "Not specified"}
                          </div>
                          <div className={styles.experienceSubtext}>
                            {guide?.experienceYears
                              ? `Guiding since ${new Date().getFullYear() - guide.experienceYears}`
                              : "of professional guiding experience"}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className={styles.section}>
                      <h3 className={styles.subsectionTitle}>Ratings & Reviews</h3>
                      <div className={styles.ratingCard}>
                        <div className={styles.ratingStars}>
                          {guide?.ratingSummary ? (
                            <>
                              <span className={styles.ratingValue}>
                                ★ {guide.ratingSummary.average}
                              </span>
                              <span className={styles.ratingCount}>
                                ({guide.ratingSummary.count} reviews)
                              </span>
                            </>
                          ) : (
                            <span className={styles.ratingEmpty}>No ratings yet</span>
                          )}
                        </div>
                      </div>
                    </div>

                    {guide?.certificates && guide.certificates.length > 0 && (
                      <div className={styles.section}>
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
                                {c.credentialId && (
                                  <div className={styles.certificateId}>
                                    ID: {c.credentialId}
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {/* ✅ Activity tab — unified trips + reviews with segmented control */}
            {activeTab === "activity" && (
              <div className={styles.tabContent}>
                <ActivityTab />
              </div>
            )}

            {/* Posts tab — coming soon */}
            {activeTab === "posts" && (
              <div className={styles.tabContent}>
                <div className={styles.comingSoon}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
                  </svg>
                  <h3>Posts coming soon</h3>
                  <p>Share your adventures and stories with the community.</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
// src/pages/ActivityDetailsPage.tsx
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import type { PublicSession, PublicTemplateCard } from "../types/activity";
import styles from "../style/activity-details.module.css";
import { getPublicTemplateById, listPublicTemplateSessions } from "../api/activity.api";
import { Header } from "../components/Header";

type LoadState = "loading" | "error" | "done" | "notfound";

function formatPrice(price: number) {
  if (Number.isNaN(price)) return "";
  return price === 0 ? "Free" : `${price} TND`;
}

function formatDate(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", {
    weekday: "short", month: "short", day: "numeric", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function formatDateShort(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function formatTime(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
}

// ── SVG Icon components ──
const IcoArrowLeft = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M19 12H5M12 19l-7-7 7-7" />
  </svg>
);
const IcoCheck = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);
const IcoShield = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    <polyline points="9 12 11 14 15 10" />
  </svg>
);
const IcoMapPin = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" />
    <circle cx="12" cy="10" r="3" />
  </svg>
);
const IcoCalendar = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <rect x="3" y="4" width="18" height="18" rx="2" />
    <line x1="16" y1="2" x2="16" y2="6" />
    <line x1="8" y1="2" x2="8" y2="6" />
    <line x1="3" y1="10" x2="21" y2="10" />
  </svg>
);
const IcoUsers = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
  </svg>
);
const IcoMountain = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <polygon points="3 20 9 4 15 14 18 10 21 20" />
  </svg>
);
const IcoTag = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z" />
    <line x1="7" y1="7" x2="7.01" y2="7" />
  </svg>
);
const IcoPhoto = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <rect x="3" y="3" width="18" height="18" rx="2" />
    <circle cx="8.5" cy="8.5" r="1.5" />
    <polyline points="21 15 16 10 5 21" />
  </svg>
);
const IcoLink = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" />
    <polyline points="15 3 21 3 21 9" />
    <line x1="10" y1="14" x2="21" y2="3" />
  </svg>
);
const IcoTrend = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
    <polyline points="17 6 23 6 23 12" />
  </svg>
);
const IcoSparkle = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z" />
  </svg>
);
const IcoDollar = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <line x1="12" y1="1" x2="12" y2="23" />
    <path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" />
  </svg>
);

const StarIcon = ({ state }: { state: "full" | "half" | "empty" }) => (
  <svg width="14" height="14" viewBox="0 0 24 24"
    fill={state !== "empty" ? "#f5a623" : "none"}
    stroke="#f5a623"
    strokeWidth="1.5"
    style={{ opacity: state === "half" ? 0.55 : 1 }}
  >
    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
  </svg>
);

function StarRating({ average, count }: { average: number; count: number }) {
  return (
    <span className={styles.starRow}>
      {Array.from({ length: 5 }, (_, i) => {
        const state = i + 1 <= Math.floor(average) ? "full" : i < average ? "half" : "empty";
        return <StarIcon key={i} state={state} />;
      })}
      <span className={styles.ratingAvg}>{average.toFixed(1)}</span>
      <span className={styles.ratingCount}>({count} reviews)</span>
    </span>
  );
}

const DIFF_LABELS: Record<string, string> = { EASY: "Easy", MEDIUM: "Medium", HARD: "Hard" };

export default function ActivityDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const nav = useNavigate();

  const [state, setState] = useState<LoadState>("loading");
  const [template, setTemplate] = useState<PublicTemplateCard | null>(null);
  const [sessions, setSessions] = useState<PublicSession[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [activeImageIdx, setActiveImageIdx] = useState(0);
  const [galleryOpen, setGalleryOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!id) { setState("notfound"); return; }
      setState("loading");
      try {
        const [tpl, sess] = await Promise.all([getPublicTemplateById(id), listPublicTemplateSessions(id)]);
        if (cancelled) return;
        setTemplate(tpl);
        setSessions(sess ?? []);
        setSelectedSessionId(tpl?.nextSession?.id ?? sess?.[0]?.id ?? null);
        setState("done");
      } catch (err: any) {
        if (cancelled) return;
        setState(String(err?.message ?? "").includes("404") ? "notfound" : "error");
      }
    })();
    return () => { cancelled = true; };
  }, [id]);

  const selectedSession = useMemo(() => sessions.find((s) => s.id === selectedSessionId) ?? null, [sessions, selectedSessionId]);
  const spotsLeft = useMemo(() => selectedSession ? Math.max(0, selectedSession.capacity - selectedSession.bookedCount) : null, [selectedSession]);

  const allImages = useMemo(() => {
    if (!template) return [];
    const imgs = template.images ?? [];
    if (imgs.length > 0) return imgs;
    if (template.coverImageUrl) return [{ url: template.coverImageUrl, cover: true, order: 0, alt: template.title }];
    return [];
  }, [template]);

  if (state === "loading") return (
    <><Header /><main className={styles.detailsRoot}><div className={styles.loadingState}><div className={styles.spinner} /><p>Loading adventure...</p></div></main></>
  );
  if (state === "notfound" || state === "error" || !template) return (
    <><Header /><main className={styles.detailsRoot}><div className={styles.errorState}><h2>{state === "notfound" ? "Adventure Not Found" : "Something Went Wrong"}</h2><p>{state === "notfound" ? "This experience doesn't exist or has been removed." : "We couldn't load this adventure."}</p>{state === "notfound" ? <Link to="/home" className={styles.btnPrimary}>Explore Adventures</Link> : <button className={styles.btnPrimary} onClick={() => nav(0)} type="button">Try Again</button>}</div></main></>
  );

  const safeDiff = template.difficulty ?? "EASY";
  const totalBooked = template.totalBookedCount ?? 0;

  return (
    <>
      <Header />

      {/* Lightbox */}
      {galleryOpen && allImages.length > 0 && (
        <div className={styles.lightboxOverlay} onClick={() => setGalleryOpen(false)}>
          <button className={styles.lightboxClose} onClick={() => setGalleryOpen(false)}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
          <button className={`${styles.lightboxNav} ${styles.lbPrev}`} onClick={(e) => { e.stopPropagation(); setActiveImageIdx((i) => (i - 1 + allImages.length) % allImages.length); }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M15 18l-6-6 6-6"/></svg>
          </button>
          <img src={allImages[activeImageIdx]?.url} alt={allImages[activeImageIdx]?.alt ?? ""} className={styles.lightboxImg} onClick={(e) => e.stopPropagation()} />
          <button className={`${styles.lightboxNav} ${styles.lbNext}`} onClick={(e) => { e.stopPropagation(); setActiveImageIdx((i) => (i + 1) % allImages.length); }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M9 18l6-6-6-6"/></svg>
          </button>
          <div className={styles.lightboxCounter}>{activeImageIdx + 1} / {allImages.length}</div>
        </div>
      )}

      <main className={styles.detailsRoot}>

        {/* Back */}
        <div className={styles.topBar}>
          <Link to="/home" className={styles.backBtn}><IcoArrowLeft /> Back to adventures</Link>
        </div>

        {/* Gallery */}
        {allImages.length > 0 && (
          <div className={styles.galleryGrid}>
            <div className={styles.galleryMain} onClick={() => { setActiveImageIdx(0); setGalleryOpen(true); }}>
              <img src={allImages[0]?.url} alt={allImages[0]?.alt ?? template.title} />
            </div>
            <div className={styles.galleryThumbs}>
              {allImages.slice(1, 5).map((img, idx) => (
                <div
                  key={img.url}
                  className={`${styles.galleryThumb} ${idx === 1 ? styles.thumbTR : ""} ${idx === 3 ? styles.thumbBR : ""}`}
                  onClick={() => { setActiveImageIdx(idx + 1); setGalleryOpen(true); }}
                >
                  <img src={img.url} alt={img.alt ?? ""} />
                  {idx === 3 && allImages.length > 5 && <div className={styles.moreOverlay}>+{allImages.length - 5}</div>}
                </div>
              ))}
            </div>
            {allImages.length > 1 && (
              <button className={styles.showAllBtn} onClick={() => { setActiveImageIdx(0); setGalleryOpen(true); }}>
                <IcoPhoto /> Show all {allImages.length} photos
              </button>
            )}
          </div>
        )}

        {/* Body */}
        <div className={styles.contentGrid}>

          {/* ══ LEFT ══ */}
          <div className={styles.leftCol}>

            {/* Title block */}
            <div className={styles.titleBlock}>
              <div className={styles.badgeRow}>
                <span className={`${styles.diffBadge} ${styles[`diff${safeDiff}`]}`}>
                  <IcoMountain /> {DIFF_LABELS[safeDiff] ?? safeDiff}
                </span>
                {template.tags?.slice(0, 3).map((t) => (
                  <span key={t} className={styles.tagChip}><IcoTag /> {t}</span>
                ))}
              </div>

              <h1 className={styles.activityTitle}>{template.title}</h1>

              <div className={styles.metaRow}>
                <StarRating average={template.rating?.average ?? 0} count={template.rating?.count ?? 0} />
                <span className={styles.dot}>·</span>
                {totalBooked > 0
                  ? <span className={styles.bookedPill}><IcoTrend /> {totalBooked} booked</span>
                  : <span className={styles.firstPill}><IcoSparkle /> Be the first to book</span>
                }
                {(template.upcomingSessionsCount ?? 0) > 0 && (
                  <><span className={styles.dot}>·</span><span className={styles.metaText}>{template.upcomingSessionsCount} upcoming dates</span></>
                )}
              </div>
            </div>

            <div className={styles.divider} />

            {/* ── DATES — prominent position ── */}
            <section className={styles.datesSection}>
              <div className={styles.datesSectionHead}>
                <h2 className={styles.sectionTitle}>Available dates</h2>
                {sessions.length > 0 && <span className={styles.datesCountBadge}>{sessions.length} date{sessions.length !== 1 ? "s" : ""}</span>}
              </div>

              {sessions.length === 0 ? (
                <div className={styles.noDates}>
                  <IcoCalendar />
                  <span>No upcoming dates. Check back soon.</span>
                </div>
              ) : (
                <div className={styles.sessionGrid}>
                  {sessions.map((s) => {
                    const left = Math.max(0, s.capacity - s.bookedCount);
                    const active = s.id === selectedSessionId;
                    const soldOut = left === 0;
                    const scarce = !soldOut && left <= 3;

                    return (
                      <button
                        key={s.id}
                        type="button"
                        disabled={soldOut}
                        onClick={() => !soldOut && setSelectedSessionId(s.id)}
                        className={`${styles.sessionCard} ${active ? styles.sessionActive : ""} ${soldOut ? styles.sessionSoldOut : ""}`}
                      >
                        {active && <span className={styles.sessionCheckmark}><IcoCheck /></span>}
                        <div className={styles.sessionDateLine}>{formatDateShort(s.date)}</div>
                        <div className={styles.sessionTimeLine}>{formatTime(s.date)}</div>
                        <div className={styles.sessionSpotsLine}>
                          {soldOut ? <span className={styles.tagSoldOut}>Sold out</span>
                            : scarce ? <span className={styles.tagScarce}>{left} spot{left > 1 ? "s" : ""} left</span>
                            : <span className={styles.tagOk}>{left}/{s.capacity} spots</span>}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </section>

            <div className={styles.divider} />

            {/* Guide */}
            {template.guide && (
              <div className={styles.guideCard}>
                <div className={styles.guideAvatarWrap}>
                  {template.guide.profileImageUrl
                    ? <img src={template.guide.profileImageUrl} alt={template.guide.username} className={styles.guideImg} />
                    : <div className={styles.guidePlaceholder}>{template.guide.username[0].toUpperCase()}</div>
                  }
                  {template.guide.verifiedBadge && <div className={styles.guideBadgeRing}><IcoShield /></div>}
                </div>
                <div className={styles.guideInfo}>
                  <div className={styles.guideLabel}>Your guide</div>
                  <div className={styles.guideName}>
                    {template.guide.username}
                    {template.guide.verifiedBadge && <span className={styles.verifiedChip}><IcoCheck /> Verified</span>}
                  </div>
                  <div className={styles.guideMeta}>
                    {template.guide.experienceYears != null && <span>{template.guide.experienceYears} yrs experience</span>}
                    {template.guide.rating?.count > 0 && (
                      <><span className={styles.dot}>·</span><span>{template.guide.rating.average.toFixed(1)} rating ({template.guide.rating.count})</span></>
                    )}
                  </div>
                </div>
              </div>
            )}

            <div className={styles.divider} />

            {/* About */}
            <section className={styles.section}>
              <h2 className={styles.sectionTitle}>About this adventure</h2>
              <p className={styles.description}>{template.description}</p>
            </section>

            {/* Quick chips */}
            <div className={styles.quickGrid}>
              <div className={styles.quickItem}>
                <div className={styles.quickIcon}><IcoMountain /></div>
                <div><div className={styles.quickLabel}>Difficulty</div><div className={styles.quickVal}>{DIFF_LABELS[safeDiff]}</div></div>
              </div>
              <div className={styles.quickItem}>
                <div className={styles.quickIcon}><IcoDollar /></div>
                <div><div className={styles.quickLabel}>Price</div><div className={styles.quickVal}>{formatPrice(Number(template.price ?? 0))}</div></div>
              </div>
              {selectedSession && (
                <div className={styles.quickItem}>
                  <div className={styles.quickIcon}><IcoUsers /></div>
                  <div><div className={styles.quickLabel}>Spots left</div><div className={styles.quickVal}>{spotsLeft}/{selectedSession.capacity}</div></div>
                </div>
              )}
              {template.addressDisplayName && (
                <div className={styles.quickItem}>
                  <div className={styles.quickIcon}><IcoMapPin /></div>
                  <div><div className={styles.quickLabel}>Location</div><div className={styles.quickVal}>{template.governorate ?? template.addressDisplayName}</div></div>
                </div>
              )}
            </div>

            <div className={styles.divider} />

            {/* Location */}
            {template.addressDisplayName && (
              <section className={styles.section}>
                <h2 className={styles.sectionTitle}>Meeting point</h2>
                <div className={styles.locationCard}>
                  <div className={styles.locationIconBox}><IcoMapPin /></div>
                  <div>
                    <div className={styles.locationName}>{template.addressDisplayName}</div>
                    {template.governorate && <div className={styles.locationSub}>{template.governorate}</div>}
                    {template.latitude && template.longitude && (
                      <a href={`https://www.google.com/maps?q=${template.latitude},${template.longitude}`} target="_blank" rel="noopener noreferrer" className={styles.mapLink}>
                        View on Google Maps <IcoLink />
                      </a>
                    )}
                  </div>
                </div>
              </section>
            )}

            <div style={{ height: 80 }} />
          </div>

          {/* ══ SIDEBAR ══ */}
          <aside className={styles.sidebar}>
            <div className={styles.sidebarCard}>
              <div className={styles.sidebarTop}>
                <span className={styles.sidebarPrice}>{formatPrice(Number(template.price ?? 0))}</span>
                {Number(template.price) > 0 && <span className={styles.sidebarPriceUnit}> / person</span>}
              </div>
              <StarRating average={template.rating?.average ?? 0} count={template.rating?.count ?? 0} />

              <div className={styles.sidebarDivider} />

              <div className={styles.sidebarFields}>
                <div className={styles.sidebarField}>
                  <span className={styles.sidebarFieldLabel}><IcoCalendar /> Selected date</span>
                  <span className={styles.sidebarFieldVal}>{selectedSession ? formatDateShort(selectedSession.date) : "—"}</span>
                </div>
                <div className={styles.sidebarField}>
                  <span className={styles.sidebarFieldLabel}><IcoUsers /> Availability</span>
                  <span className={styles.sidebarFieldVal}>
                    {spotsLeft == null ? "—"
                      : spotsLeft === 0 ? <span className={styles.tagSoldOut}>Sold out</span>
                      : spotsLeft <= 3 ? <span className={styles.tagScarce}>{spotsLeft} spots left</span>
                      : `${spotsLeft} spots`}
                  </span>
                </div>
              </div>

              <div className={styles.sidebarBookedRow}>
                {totalBooked > 0
                  ? <span className={styles.bookedPill}><IcoTrend /> {totalBooked} people booked this</span>
                  : <span className={styles.firstPill}><IcoSparkle /> Be the first to book</span>
                }
              </div>

              <div className={styles.sidebarDivider} />

              <button className={styles.bookBtn} type="button" disabled={!selectedSessionId || spotsLeft === 0}>
                Book This Adventure
                <span className={styles.comingSoonPill}>Coming Soon</span>
              </button>
              <p className={styles.noCharge}>You won't be charged yet</p>

              {template.guide && (
                <div className={styles.sidebarGuide}>
                  {template.guide.profileImageUrl
                    ? <img src={template.guide.profileImageUrl} alt={template.guide.username} className={styles.sidebarGuideImg} />
                    : <div className={styles.sidebarGuidePlaceholder}>{template.guide.username[0].toUpperCase()}</div>
                  }
                  <div>
                    <div className={styles.sidebarGuideLabel}>Guided by</div>
                    <div className={styles.sidebarGuideName}>{template.guide.username}</div>
                  </div>
                </div>
              )}
            </div>
          </aside>
        </div>
      </main>
    </>
  );
}
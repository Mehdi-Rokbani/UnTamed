// src/pages/ActivityDetailsPage.tsx — redesigned for GetYourGuide / Airbnb Experiences feel
import { useEffect, useMemo, useState, useCallback, type CSSProperties } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import type { PublicSession, PublicTemplateCard } from "../types/activity";
import type { Review } from "../types/review";
import styles from "../style/activity-details.module.css";
import {
  getPublicTemplateById,
  listPublicTemplateSessions,
} from "../api/activity.api";
import { Header } from "../components/Header";
import { useAuth } from "../auth/auth.store";
import * as BookingApi from "../api/booking.api";
import * as ReviewApi from "../api/review.api";
import ReviewList from "../components/review/ReviewList";
import { getParticipantsPreview } from "../api/session.api";
import type { ParticipantsPreviewResponse } from "../types/participants";

type LoadState = "loading" | "error" | "done" | "notfound";
type BookingStep = "idle" | "selecting" | "confirming" | "success";

function formatPrice(price: number) {
  if (Number.isNaN(price)) return "";
  return price === 0 ? "Free" : `${price} TND`;
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

function formatCountdown(ms: number) {
  if (ms <= 0) return null;
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

// ── SVG Icons ──
const IcoArrowLeft = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M19 12H5M12 19l-7-7 7-7" />
  </svg>
);
const IcoCheck = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);
const IcoShield = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    <polyline points="9 12 11 14 15 10" />
  </svg>
);
const IcoMapPin = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" />
    <circle cx="12" cy="10" r="3" />
  </svg>
);
const IcoCalendar = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <rect x="3" y="4" width="18" height="18" rx="2" />
    <line x1="16" y1="2" x2="16" y2="6" />
    <line x1="8" y1="2" x2="8" y2="6" />
    <line x1="3" y1="10" x2="21" y2="10" />
  </svg>
);
const IcoUsers = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
  </svg>
);
const IcoMountain = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <polygon points="3 20 9 4 15 14 18 10 21 20" />
  </svg>
);
const IcoTag = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z" />
    <line x1="7" y1="7" x2="7.01" y2="7" />
  </svg>
);
const IcoPhoto = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <rect x="3" y="3" width="18" height="18" rx="2" />
    <circle cx="8.5" cy="8.5" r="1.5" />
    <polyline points="21 15 16 10 5 21" />
  </svg>
);
const IcoLink = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" />
    <polyline points="15 3 21 3 21 9" />
    <line x1="10" y1="14" x2="21" y2="3" />
  </svg>
);
const IcoTrend = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
    <polyline points="17 6 23 6 23 12" />
  </svg>
);
const IcoSparkle = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z" />
  </svg>
);
const IcoDollar = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <line x1="12" y1="1" x2="12" y2="23" />
    <path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" />
  </svg>
);
const IcoClock = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <circle cx="12" cy="12" r="10" />
    <polyline points="12 6 12 12 16 14" />
  </svg>
);
const IcoBookmark = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z" />
  </svg>
);
const IcoArrowRight = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 12h14M12 5l7 7-7 7" />
  </svg>
);
const IcoFire = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 2c0 0-5 4-5 10a5 5 0 0010 0c0-6-5-10-5-10zm0 14a3 3 0 01-3-3c0-3 3-6 3-6s3 3 3 6a3 3 0 01-3 3z" />
  </svg>
);
const IcoClose = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

const StarIcon = ({ state }: { state: "full" | "half" | "empty" }) => (
  <svg
    width="13" height="13" viewBox="0 0 24 24"
    fill={state !== "empty" ? "#f5a623" : "none"}
    stroke="#f5a623" strokeWidth="1.5"
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

const DIFF_LABELS: Record<string, string> = {
  EASY: "Easy", MEDIUM: "Medium", HARD: "Hard",
};

function ConfettiBurst() {
  const pieces = Array.from({ length: 18 }, (_, i) => i);
  const colors = ["#ff8c42", "#ffa566", "#1a4d2e", "#2d5f3e", "#fff176", "#f48fb1"];
  return (
    <div className={styles.confettiWrap} aria-hidden="true">
      {pieces.map((i) => (
        <div
          key={i}
          className={styles.confettiPiece}
          style={{
            "--angle": `${(i / pieces.length) * 360}deg`,
            "--dist": `${40 + Math.random() * 50}px`,
            "--color": colors[i % colors.length],
            "--delay": `${Math.random() * 0.2}s`,
            "--size": `${5 + Math.random() * 5}px`,
          } as CSSProperties}
        />
      ))}
    </div>
  );
}

// ── Review Modal ──
type ReviewModalProps = {
  open: boolean;
  mode: "create" | "edit";
  submitting: boolean;
  initialRating: number;
  initialComment: string;
  error: string | null;
  onClose: () => void;
  onSubmit: (payload: { rating: number; comment: string }) => Promise<void>;
};

function ReviewModal({ open, mode, submitting, initialRating, initialComment, error, onClose, onSubmit }: ReviewModalProps) {
  const [rating, setRating] = useState(initialRating);
  const [comment, setComment] = useState(initialComment);

  useEffect(() => {
    if (!open) return;
    setRating(initialRating);
    setComment(initialComment);
  }, [open, initialRating, initialComment]);

  if (!open) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = comment.trim();
    if (!rating || !trimmed) return;
    await onSubmit({ rating, comment: trimmed });
  }

  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 16 }}
      onClick={onClose}
    >
      <div
        style={{ width: "100%", maxWidth: 520, background: "#fff", borderRadius: 20, boxShadow: "0 20px 50px rgba(0,0,0,0.18)", padding: 24 }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: "#1a1a1a" }}>
          {mode === "edit" ? "Edit your review" : "Write a review"}
        </h3>
        <p style={{ marginTop: 6, marginBottom: 18, color: "#6b7a70", fontSize: 14 }}>
          {mode === "edit" ? "Update your rating and comment." : "Share your experience with other explorers."}
        </p>

        <form onSubmit={handleSubmit}>
          <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
            {Array.from({ length: 5 }, (_, i) => {
              const value = i + 1;
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => !submitting && setRating(value)}
                  style={{ fontSize: 30, lineHeight: 1, background: "transparent", border: "none", cursor: submitting ? "default" : "pointer", color: value <= rating ? "#f5a623" : "#d8cfc8", padding: 0 }}
                  aria-label={`Rate ${value} star${value > 1 ? "s" : ""}`}
                >★</button>
              );
            })}
          </div>

          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Tell people what made this activity special..."
            style={{ width: "100%", minHeight: 120, resize: "vertical", borderRadius: 12, border: "1px solid #ddd2c8", padding: 12, fontSize: 14, outline: "none", color: "#1a1a1a", background: "#fffdfb", boxSizing: "border-box" }}
            disabled={submitting}
            maxLength={1000}
          />

          {error && <p style={{ marginTop: 10, color: "#b42318", fontWeight: 600, fontSize: 13 }}>{error}</p>}

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 16 }}>
            <button type="button" onClick={onClose} style={{ padding: "9px 14px", borderRadius: 10, border: "1px solid #d8cfc8", background: "#fff", fontWeight: 700, cursor: submitting ? "default" : "pointer", fontSize: 13 }} disabled={submitting}>
              Cancel
            </button>
            <button
              type="submit"
              style={{ padding: "9px 14px", borderRadius: 10, border: "none", background: "#1a4d2e", color: "#fff", fontWeight: 700, cursor: submitting ? "default" : "pointer", opacity: submitting ? 0.7 : 1, fontSize: 13 }}
              disabled={submitting || !rating || !comment.trim()}
            >
              {submitting ? (mode === "edit" ? "Saving..." : "Posting...") : (mode === "edit" ? "Save changes" : "Post review")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Participants Modal ──
function ParticipantsModal({ preview, onClose }: { preview: ParticipantsPreviewResponse; onClose: () => void }) {
  return (
    <div className={styles.participantsModal} onClick={onClose}>
      <div className={styles.participantsModalCard} onClick={(e) => e.stopPropagation()}>
        <div className={styles.participantsModalHeader}>
          <h3>Who's joining</h3>
          <button className={styles.modalCloseBtn} onClick={onClose} type="button">
            <IcoClose />
          </button>
        </div>

        {preview.participants.map((p) => (
          <div key={p.userId} className={styles.participantRow}>
            <div className={styles.participantAvatar}>
              {p.profileImageUrl
                ? <img src={p.profileImageUrl} alt={p.username} />
                : <span>{p.username.charAt(0).toUpperCase()}</span>
              }
            </div>
            <span className={styles.participantName}>{p.username}</span>
          </div>
        ))}

        {preview.totalConfirmed > preview.participants.length && (
          <p className={styles.participantsMeta} style={{ marginTop: 12, textAlign: "center" }}>
            +{preview.totalConfirmed - preview.participants.length} more joined
          </p>
        )}
      </div>
    </div>
  );
}

// ══ MAIN PAGE COMPONENT ══
export default function ActivityDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const nav = useNavigate();
  const { user, loading: authLoading, refreshMe } = useAuth();

  const [state, setState] = useState<LoadState>("loading");
  const [template, setTemplate] = useState<PublicTemplateCard | null>(null);
  const [sessions, setSessions] = useState<PublicSession[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [activeImageIdx, setActiveImageIdx] = useState(0);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [participantsModalOpen, setParticipantsModalOpen] = useState(false);

  const [participantsPreview, setParticipantsPreview] = useState<ParticipantsPreviewResponse | null>(null);
  const [participantsLoading, setParticipantsLoading] = useState(false);

  const [people, setPeople] = useState(1);
  const [bookingStep, setBookingStep] = useState<BookingStep>("idle");
  const [bookingError, setBookingError] = useState<string | null>(null);
  const [bookingSuccessId, setBookingSuccessId] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());

  const [myReview, setMyReview] = useState<Review | null>(null);
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [reviewReloadKey, setReviewReloadKey] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(t);
  }, []);

  const loadAll = useCallback(async () => {
    if (!id) { setState("notfound"); return; }
    setState("loading");
    try {
      const [tpl, sess] = await Promise.all([getPublicTemplateById(id), listPublicTemplateSessions(id)]);
      setTemplate(tpl);
      setSessions(sess ?? []);
      setSelectedSessionId(tpl?.nextSession?.id ?? sess?.[0]?.id ?? null);
      setState("done");
    } catch (err: any) {
      setState(String(err?.message ?? "").includes("404") ? "notfound" : "error");
    }
  }, [id]);

  const loadMyReview = useCallback(async () => {
    if (!id || !user) { setMyReview(null); return; }
    try {
      const data = await ReviewApi.getMyReviewForTemplate(id);
      setMyReview(data);
    } catch (err: any) {
      setMyReview(null);
    }
  }, [id, user]);

  useEffect(() => { loadAll(); }, [loadAll]);
  useEffect(() => { if (!authLoading) loadMyReview(); }, [authLoading, loadMyReview]);

  useEffect(() => {
    if (!selectedSessionId) { setParticipantsPreview(null); return; }
    let cancelled = false;
    (async () => {
      try {
        setParticipantsLoading(true);
        const data = await getParticipantsPreview(selectedSessionId);
        if (!cancelled) setParticipantsPreview(data);
      } catch {
        if (!cancelled) setParticipantsPreview(null);
      } finally {
        if (!cancelled) setParticipantsLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [selectedSessionId]);

  const selectedSession = useMemo(
    () => sessions.find((s) => s.id === selectedSessionId) ?? null,
    [sessions, selectedSessionId]
  );
  const spotsLeft = useMemo(
    () => selectedSession ? Math.max(0, selectedSession.capacity - selectedSession.bookedCount) : null,
    [selectedSession]
  );

  useEffect(() => {
    if (spotsLeft == null || spotsLeft <= 0) return;
    if (people > spotsLeft) setPeople(spotsLeft);
    if (people <= 0) setPeople(1);
  }, [spotsLeft, selectedSessionId, people]);

  const allImages = useMemo(() => {
    if (!template) return [];
    const imgs = (template as any).images ?? [];
    if (imgs.length > 0) return imgs;
    if ((template as any).coverImageUrl) {
      return [{ url: (template as any).coverImageUrl, cover: true, order: 0, alt: (template as any).title }];
    }
    return [];
  }, [template]);

  const guideOwnerId = useMemo(() => (
    ((selectedSession as any)?.guideId ?? (template as any)?.guideId ?? (template as any)?.guide?.id ?? null) as string | null
  ), [selectedSession, template]);

  const isGuideOwner = useMemo(() => !!(user && guideOwnerId && user.id === guideOwnerId), [user, guideOwnerId]);

  const cutoffMs = useMemo(() => {
    if (!selectedSession) return null;
    const start = new Date(selectedSession.date).getTime();
    if (Number.isNaN(start)) return null;
    return start - now;
  }, [selectedSession, now]);

  const isWithinCutoff = useMemo(() => cutoffMs !== null && cutoffMs < 5 * 3600000, [cutoffMs]);
  const isWarnCutoff   = useMemo(() => cutoffMs !== null && cutoffMs >= 0 && cutoffMs < 8 * 3600000 && !isWithinCutoff, [cutoffMs, isWithinCutoff]);

  const canBook = useMemo(() => {
    if (authLoading || !user || !selectedSessionId || !selectedSession) return false;
    if ((spotsLeft ?? 0) <= 0 || isGuideOwner || isWithinCutoff) return false;
    return true;
  }, [authLoading, user, selectedSessionId, selectedSession, spotsLeft, isGuideOwner, isWithinCutoff]);

  const price = Number((template as any)?.price ?? 0);
  const totalPrice = price * people;
 const totalBooked = (template as any)?.totalBookedCount ?? 0;

  const mostBookedSessionId = useMemo(() => {
    if (!sessions.length) return null;
    return sessions.reduce((a, b) => (b.bookedCount > a.bookedCount ? b : a)).id;
  }, [sessions]);

  const canWriteOrEditReview = !!user && !isGuideOwner && !!template;

  async function onBook() {
    if (!canBook || !selectedSessionId) return;
    setBookingError(null);
    setBookingStep("confirming");
    try {
      const res = await BookingApi.createOrIncreaseBooking({ sessionId: selectedSessionId, numberOfPeople: people });
      setBookingSuccessId(res.id);
      setBookingStep("success");
      await refreshMe();
      const [tpl, sess] = await Promise.all([getPublicTemplateById(id!), listPublicTemplateSessions(id!)]);
      setTemplate(tpl);
      setSessions(sess ?? []);
    } catch (e: any) {
      setBookingError(e?.message ?? "Booking failed");
      setBookingStep("idle");
    }
  }

  function onSessionSelect(sid: string) {
    setSelectedSessionId(sid);
    setBookingStep("idle");
    setBookingSuccessId(null);
    setBookingError(null);
  }

  async function handleReviewSubmit(payload: { rating: number; comment: string }) {
    if (!template?.id) return;
    setReviewError(null);
    setReviewSubmitting(true);
    try {
      if (myReview?.id) {
        await ReviewApi.updateReview(myReview.id, payload);
      } else {
        await ReviewApi.createReviewForTemplate(template.id, payload);
      }
      setReviewModalOpen(false);
      await Promise.all([loadAll(), loadMyReview()]);
      setReviewReloadKey((v) => v + 1);
    } catch (err: any) {
      setReviewError(err?.response?.data?.message || err?.message || "Failed to submit review.");
    } finally {
      setReviewSubmitting(false);
    }
  }

  // ── Loading / Error states ──
  if (state === "loading") {
    return (
      <>
        <Header />
        <main className={styles.detailsRoot}>
          <div className={styles.loadingState}>
            <div className={styles.spinner} />
            <p>Loading adventure...</p>
          </div>
        </main>
      </>
    );
  }

  if (state === "notfound" || state === "error" || !template) {
    return (
      <>
        <Header />
        <main className={styles.detailsRoot}>
          <div className={styles.errorState}>
            <h2>{state === "notfound" ? "Adventure Not Found" : "Something Went Wrong"}</h2>
            <p>{state === "notfound" ? "This experience doesn't exist or has been removed." : "We couldn't load this adventure."}</p>
            {state === "notfound"
              ? <Link to="/home" className={styles.btnPrimary}>Explore Adventures</Link>
              : <button className={styles.btnPrimary} onClick={() => nav(0)} type="button">Try Again</button>
            }
          </div>
        </main>
      </>
    );
  }

  const safeDiff = (template as any).difficulty ?? "EASY";

  return (
    <>
      <Header />

      <ReviewModal
        open={reviewModalOpen}
        mode={myReview ? "edit" : "create"}
        submitting={reviewSubmitting}
        initialRating={myReview?.rating ?? 0}
        initialComment={myReview?.comment ?? ""}
        error={reviewError}
        onClose={() => { if (!reviewSubmitting) { setReviewModalOpen(false); setReviewError(null); } }}
        onSubmit={handleReviewSubmit}
      />

      {participantsModalOpen && participantsPreview && participantsPreview.totalConfirmed > 0 && (
        <ParticipantsModal preview={participantsPreview} onClose={() => setParticipantsModalOpen(false)} />
      )}

      {/* ── Lightbox ── */}
      {galleryOpen && allImages.length > 0 && (
        <div className={styles.lightboxOverlay} onClick={() => setGalleryOpen(false)}>
          <button className={styles.lightboxClose} onClick={() => setGalleryOpen(false)} type="button">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
          <button className={`${styles.lightboxNav} ${styles.lbPrev}`} onClick={(e) => { e.stopPropagation(); setActiveImageIdx((i) => (i - 1 + allImages.length) % allImages.length); }} type="button">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M15 18l-6-6 6-6" /></svg>
          </button>
          <img src={allImages[activeImageIdx]?.url} alt={allImages[activeImageIdx]?.alt ?? ""} className={styles.lightboxImg} onClick={(e) => e.stopPropagation()} />
          <button className={`${styles.lightboxNav} ${styles.lbNext}`} onClick={(e) => { e.stopPropagation(); setActiveImageIdx((i) => (i + 1) % allImages.length); }} type="button">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M9 18l6-6-6-6" /></svg>
          </button>
          <div className={styles.lightboxCounter}>{activeImageIdx + 1} / {allImages.length}</div>
        </div>
      )}

      <main className={styles.detailsRoot}>
        <div className={styles.topBar}>
          <Link to="/home" className={styles.backBtn}>
            <IcoArrowLeft /> Back to adventures
          </Link>
        </div>

        <div className={styles.pageWrapper}>

          {/* ══ CONTENT + SIDEBAR ══ */}
          <div className={styles.contentGrid}>

            {/* ── LEFT COLUMN ── */}
            <div className={styles.leftCol}>

              {/* Title block */}
              <div className={styles.titleBlock}>
                <div className={styles.badgeRow}>
                  <span className={`${styles.diffBadge} ${styles[`diff${safeDiff}`]}`}>
                    <IcoMountain /> {DIFF_LABELS[safeDiff] ?? safeDiff}
                  </span>
                  {(template as any).tags?.slice(0, 3).map((t: string) => (
                    <span key={t} className={styles.tagChip}><IcoTag /> {t}</span>
                  ))}
                </div>

                <h1 className={styles.activityTitle}>{(template as any).title}</h1>

                <div className={styles.metaRow}>
                  <StarRating average={(template as any).rating?.average ?? 0} count={(template as any).rating?.count ?? 0} />
                  <span className={styles.dot}>·</span>

                  {totalBooked > 0
                    ? <span className={styles.bookedPill}><IcoTrend /> {totalBooked} booked</span>
                    : <span className={styles.firstPill}><IcoSparkle /> Be the first to book</span>
                  }

                  {((template as any).upcomingSessionsCount ?? 0) > 0 && (
                    <>
                      <span className={styles.dot}>·</span>
                      <span className={styles.metaText}>{(template as any).upcomingSessionsCount} upcoming dates</span>
                    </>
                  )}
                </div>
              </div>

              {/* ══ HERO GALLERY (inside left column) ══ */}
              {allImages.length > 1 ? (
                <div className={styles.heroGallery}>
                  <div className={styles.heroMain} onClick={() => { setActiveImageIdx(0); setGalleryOpen(true); }}>
                    <img src={allImages[0]?.url} alt={allImages[0]?.alt ?? (template as any).title} />
                  </div>
                  <div className={styles.heroThumbsCol}>
                    {allImages.slice(1, 3).map((img: any, idx: number) => (
                      <div
                        key={img.url}
                        className={styles.heroThumb}
                        onClick={() => { setActiveImageIdx(idx + 1); setGalleryOpen(true); }}
                      >
                        <img src={img.url} alt={img.alt ?? ""} />
                        {idx === 1 && allImages.length > 3 && (
                          <div className={styles.moreOverlay}>+{allImages.length - 3}</div>
                        )}
                      </div>
                    ))}
                  </div>
                  <button
                    className={styles.viewAllBtn}
                    onClick={() => { setActiveImageIdx(0); setGalleryOpen(true); }}
                    type="button"
                  >
                    <IcoPhoto /> Show all {allImages.length} photos
                  </button>
                </div>
              ) : allImages.length === 1 ? (
                <div className={styles.heroSingle} onClick={() => { setActiveImageIdx(0); setGalleryOpen(true); }}>
                  <img src={allImages[0]?.url} alt={allImages[0]?.alt ?? (template as any).title} />
                </div>
              ) : null}

              <div className={styles.divider} />

              {/* Available dates */}
              <section className={styles.datesSection}>
                <div className={styles.datesSectionHead}>
                  <h2 className={styles.sectionTitle}>Available dates</h2>
                  {sessions.length > 0 && (
                    <span className={styles.datesCountBadge}>{sessions.length} date{sessions.length !== 1 ? "s" : ""}</span>
                  )}
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
                      const popular = s.id === mostBookedSessionId && s.bookedCount > 0;

                      return (
                        <button
                          key={s.id}
                          type="button"
                          disabled={soldOut}
                          onClick={() => !soldOut && onSessionSelect(s.id)}
                          className={`${styles.sessionCard} ${active ? styles.sessionActive : ""} ${soldOut ? styles.sessionSoldOut : ""}`}
                        >
                          {popular && !soldOut && (
                            <span className={styles.popularBadge}><IcoFire /> Popular</span>
                          )}
                          {active && <span className={styles.sessionCheckmark}><IcoCheck /></span>}
                          {scarce && !soldOut && <span className={styles.scarcePulse} />}
                          <div className={styles.sessionDateLine}>{formatDateShort(s.date)}</div>
                          <div className={styles.sessionTimeLine}>{formatTime(s.date)}</div>
                          <div className={styles.sessionSpotsLine}>
                            {soldOut
                              ? <span className={styles.tagSoldOut}>Sold out</span>
                              : scarce
                              ? <span className={styles.tagScarce}>{left} spot{left > 1 ? "s" : ""} left</span>
                              : <span className={styles.tagOk}>{left}/{s.capacity} spots</span>
                            }
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </section>

              <div className={styles.divider} />

              {/* Guide */}
              {(template as any).guide && (
                <div className={styles.guideCard}>
                  <div className={styles.guideAvatarWrap}>
                    {(template as any).guide.profileImageUrl
                      ? <img src={(template as any).guide.profileImageUrl} alt={(template as any).guide.username} className={styles.guideImg} />
                      : <div className={styles.guidePlaceholder}>{String((template as any).guide.username ?? "?")[0].toUpperCase()}</div>
                    }
                    {(template as any).guide.verifiedBadge && (
                      <div className={styles.guideBadgeRing}><IcoShield /></div>
                    )}
                  </div>
                  <div className={styles.guideInfo}>
                    <div className={styles.guideLabel}>Your guide</div>
                    <div className={styles.guideName}>
                      {(template as any).guide.username}
                      {(template as any).guide.verifiedBadge && (
                        <span className={styles.verifiedChip}><IcoCheck /> Verified</span>
                      )}
                    </div>
                    <div className={styles.guideMeta}>
                      {(template as any).guide.experienceYears != null && (
                        <span>{(template as any).guide.experienceYears} yrs experience</span>
                      )}
                      {(template as any).guide.rating?.count > 0 && (
                        <>
                          <span className={styles.dot}>·</span>
                          <span>{(template as any).guide.rating.average.toFixed(1)} rating ({(template as any).guide.rating.count})</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              )}

              <div className={styles.divider} />

              {/* About */}
              <section className={styles.section}>
                <h2 className={styles.sectionTitle}>About this adventure</h2>
                <p className={styles.description}>{(template as any).description}</p>
              </section>

              {/* Quick info grid */}
              <div className={styles.quickGrid}>
                <div className={styles.quickItem}>
                  <div className={styles.quickIcon}><IcoMountain /></div>
                  <div>
                    <div className={styles.quickLabel}>Difficulty</div>
                    <div className={styles.quickVal}>{DIFF_LABELS[safeDiff]}</div>
                  </div>
                </div>
                <div className={styles.quickItem}>
                  <div className={styles.quickIcon}><IcoDollar /></div>
                  <div>
                    <div className={styles.quickLabel}>Price</div>
                    <div className={styles.quickVal}>{formatPrice(price)}</div>
                  </div>
                </div>
                {selectedSession && (
                  <div className={styles.quickItem}>
                    <div className={styles.quickIcon}><IcoUsers /></div>
                    <div>
                      <div className={styles.quickLabel}>Spots left</div>
                      <div className={styles.quickVal}>{spotsLeft}/{selectedSession.capacity}</div>
                    </div>
                  </div>
                )}
                {(template as any).addressDisplayName && (
                  <div className={styles.quickItem}>
                    <div className={styles.quickIcon}><IcoMapPin /></div>
                    <div>
                      <div className={styles.quickLabel}>Location</div>
                      <div className={styles.quickVal}>{(template as any).governorate ?? (template as any).addressDisplayName}</div>
                    </div>
                  </div>
                )}
              </div>

              <div className={styles.divider} />

              {/* Meeting point */}
              {(template as any).addressDisplayName && (
                <section className={styles.section}>
                  <h2 className={styles.sectionTitle}>Meeting point</h2>
                  <div className={styles.locationCard}>
                    <div className={styles.locationIconBox}><IcoMapPin /></div>
                    <div>
                      <div className={styles.locationName}>{(template as any).addressDisplayName}</div>
                      {(template as any).governorate && (
                        <div className={styles.locationSub}>{(template as any).governorate}</div>
                      )}
                      {(template as any).latitude && (template as any).longitude && (
                        <a
                          href={`https://www.google.com/maps?q=${(template as any).latitude},${(template as any).longitude}`}
                          target="_blank" rel="noopener noreferrer"
                          className={styles.mapLink}
                        >
                          View on Google Maps <IcoLink />
                        </a>
                      )}
                    </div>
                  </div>
                </section>
              )}

              <div className={styles.divider} />

              {/* Reviews */}
              <section className={styles.section} id="reviews-section">
                <div className={styles.sectionTitleRow}>
                  <h2 className={styles.sectionTitle}>Reviews</h2>
                  {user && !isGuideOwner && (
                    <button
                      type="button"
                      className={styles.writeReviewBtn}
                      onClick={() => { setReviewError(null); setReviewModalOpen(true); }}
                    >
                      {myReview ? "Edit your review" : "Write a review"}
                    </button>
                  )}
                </div>

                {!user && <p className={styles.noCharge} style={{ marginBottom: 14 }}>Login to write a review.</p>}
                {user && isGuideOwner && <p className={styles.noCharge} style={{ marginBottom: 14 }}>Guides cannot review their own activity.</p>}

                <ReviewList
                  key={reviewReloadKey}
                  templateId={template.id}
                  currentUserId={user?.id ?? null}
                  guideOwnerId={guideOwnerId}
                  canReview={canWriteOrEditReview}
                  userReviewId={myReview?.id ?? null}
                />
              </section>

              <div style={{ height: 48 }} />
            </div>

            {/* ── SIDEBAR (sticky, no internal scroll) ── */}
            <aside className={styles.sidebar}>
              <div className={styles.sidebarCard}>

                {bookingStep === "success" && bookingSuccessId ? (
                  /* ── Success state ── */
                  <div className={styles.successState}>
                    <ConfettiBurst />
                    <div className={styles.successIcon}>
                      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    </div>
                    <h3 className={styles.successTitle}>You're booked!</h3>
                    <p className={styles.successSub}>
                      {people} {people === 1 ? "spot" : "spots"} confirmed for{" "}
                      <strong>{selectedSession ? formatDateShort(selectedSession.date) : "your adventure"}</strong>
                    </p>
                    {price > 0 && (
                      <div className={styles.successPriceLine}>
                        <span>Total paid</span>
                        <span className={styles.successPriceAmt}>{totalPrice} TND</span>
                      </div>
                    )}
                    <div className={styles.successId}>Booking #{bookingSuccessId.slice(-8).toUpperCase()}</div>
                    <Link to="/my-bookings" className={styles.successBtn}>
                      <IcoBookmark /> View my bookings <IcoArrowRight />
                    </Link>
                    <button
                      className={styles.successSecondary}
                      type="button"
                      onClick={() => { setBookingStep("idle"); setBookingSuccessId(null); }}
                    >
                      Book another date
                    </button>
                  </div>

                ) : (
                  /* ── Booking form ── */
                  <>
                    {/* Price */}
                    <div className={styles.sidebarTop}>
                      <span className={styles.sidebarPrice}>{formatPrice(price)}</span>
                      {price > 0 && <span className={styles.sidebarPriceUnit}> / person</span>}
                    </div>

                    <StarRating
                      average={(template as any).rating?.average ?? 0}
                      count={(template as any).rating?.count ?? 0}
                    />

                    <div className={styles.sidebarDivider} />

                    {/* Cutoff warning */}
                    {isWarnCutoff && cutoffMs !== null && (
                      <div className={styles.cutoffWarning}>
                        <IcoClock />
                        <span>Booking closes in <strong>{formatCountdown(cutoffMs)}</strong> — book soon!</span>
                      </div>
                    )}

                    {/* Fields: date, time, availability, guests */}
                    <div className={styles.sidebarFields}>
                      <div className={styles.sidebarField}>
                        <span className={styles.sidebarFieldLabel}><IcoCalendar /> Date</span>
                        <span className={styles.sidebarFieldVal}>
                          {selectedSession ? formatDateShort(selectedSession.date) : "—"}
                        </span>
                      </div>

                      {selectedSession && (
                        <div className={styles.sidebarField}>
                          <span className={styles.sidebarFieldLabel}><IcoClock /> Time</span>
                          <span className={styles.sidebarFieldVal}>{formatTime(selectedSession.date)}</span>
                        </div>
                      )}

                      <div className={styles.sidebarField}>
                        <span className={styles.sidebarFieldLabel}><IcoUsers /> Availability</span>
                        <span className={styles.sidebarFieldVal}>
                          {spotsLeft == null ? "—" : spotsLeft === 0
                            ? <span className={styles.tagSoldOut}>Sold out</span>
                            : spotsLeft <= 3
                            ? <span className={styles.tagScarce}>{spotsLeft} spots left</span>
                            : `${spotsLeft} spots`
                          }
                        </span>
                      </div>

                      <div className={styles.sidebarField}>
                        <span className={styles.sidebarFieldLabel}><IcoUsers /> Guests</span>
                        <div className={styles.peopleStepper}>
                          <button
                            className={styles.stepperBtn}
                            type="button"
                            onClick={() => setPeople((p) => Math.max(1, p - 1))}
                            disabled={people <= 1 || !selectedSession || (spotsLeft ?? 0) <= 0}
                          >−</button>
                          <span className={styles.stepperVal}>{people}</span>
                          <button
                            className={styles.stepperBtn}
                            type="button"
                            onClick={() => setPeople((p) => Math.min(Math.min(10, spotsLeft ?? 10), p + 1))}
                            disabled={people >= Math.min(10, spotsLeft ?? 10) || !selectedSession || (spotsLeft ?? 0) <= 0}
                          >+</button>
                        </div>
                      </div>
                    </div>

                    {/* Price breakdown */}
                    {price > 0 && selectedSession && (spotsLeft ?? 0) > 0 && (
                      <div className={styles.priceSummary}>
                        <div className={styles.priceSummaryRow}>
                          <span>{price} TND × {people} {people === 1 ? "person" : "people"}</span>
                          <span>{price * people} TND</span>
                        </div>
                        <div className={styles.priceSummaryTotal}>
                          <span>Total</span>
                          <span className={styles.priceSummaryTotalAmt}>{totalPrice} TND</span>
                        </div>
                      </div>
                    )}

                    {/* Social proof row */}
                    <div className={styles.sidebarBookedRow}>
                      {totalBooked > 0
                        ? <span className={styles.bookedPill}><IcoTrend /> {totalBooked} people booked this</span>
                        : <span className={styles.firstPill}><IcoSparkle /> Be the first to book</span>
                      }
                    </div>

                    {/* CTA button */}
                    <button
                      className={`${styles.bookBtn} ${bookingStep === "confirming" ? styles.bookBtnLoading : ""}`}
                      type="button"
                      disabled={!canBook || bookingStep === "confirming"}
                      onClick={onBook}
                    >
                      {bookingStep === "confirming"
                        ? <><div className={styles.bookBtnSpinner} /><span>Confirming...</span></>
                        : <span>Book This Adventure{price > 0 && selectedSession && (spotsLeft ?? 0) > 0 ? ` · ${totalPrice} TND` : ""}</span>
                      }
                    </button>

                    {!authLoading && !user && <p className={styles.noCharge}>Login to book</p>}
                    {user && isGuideOwner && <p className={styles.noCharge}>You can't book your own activity.</p>}
                    {user && isWithinCutoff && <p className={styles.noCharge} style={{ color: "#c4360c" }}>⏰ Booking closed — starts within 5 hours.</p>}
                    {bookingError && <p className={styles.bookingError}>{bookingError}</p>}
                    {!bookingError && !isWithinCutoff && <p className={styles.noCharge}>You won't be charged yet</p>}

                    <div className={styles.sidebarDivider} />

                    {/* ── Who's joining (compact social proof) ── */}
                    <div className={styles.whoJoining}>
                      {participantsLoading ? (
                        <p className={styles.noCharge}>Loading participants...</p>
                      ) : !participantsPreview || participantsPreview.totalConfirmed === 0 ? (
                        <p className={styles.noCharge}>Be the first to join this adventure.</p>
                      ) : (
                        <div className={styles.whoJoiningInner}>
                          {/* Overlapping avatars — max 4 shown */}
                          <div className={styles.avatarStack}>
                            {participantsPreview.participants.slice(0, 4).map((p) => (
                              <div key={p.userId} className={styles.avatar} title={p.username}>
                                {p.profileImageUrl
                                  ? <img src={p.profileImageUrl} alt={p.username} />
                                  : <span>{p.username.charAt(0).toUpperCase()}</span>
                                }
                              </div>
                            ))}
                            {participantsPreview.totalConfirmed > 4 && (
                              <div className={styles.moreAvatar}>
                                +{participantsPreview.totalConfirmed - 4}
                              </div>
                            )}
                          </div>

                          {/* Count + seats left */}
                          <div className={styles.whoJoiningText}>
                            <div className={styles.whoJoiningCount}>
                              {participantsPreview.totalConfirmed} joined already
                            </div>
                            {participantsPreview.seatsLeft != null && (
                              <div className={styles.whoJoiningSeats}>
                                {participantsPreview.seatsLeft} seat{participantsPreview.seatsLeft !== 1 ? "s" : ""} left
                              </div>
                            )}
                          </div>

                          {/* View all trigger */}
                          <button
                            className={styles.viewAllBtn2}
                            type="button"
                            onClick={() => setParticipantsModalOpen(true)}
                          >
                            View all
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Guide in sidebar */}
                    {(template as any).guide && (
                      <div className={styles.sidebarGuide}>
                        {(template as any).guide.profileImageUrl
                          ? <img src={(template as any).guide.profileImageUrl} alt={(template as any).guide.username} className={styles.sidebarGuideImg} />
                          : <div className={styles.sidebarGuidePlaceholder}>{String((template as any).guide.username ?? "?")[0].toUpperCase()}</div>
                        }
                        <div>
                          <div className={styles.sidebarGuideLabel}>Guided by</div>
                          <div className={styles.sidebarGuideName}>{(template as any).guide.username}</div>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </aside>
          </div>
        </div>
      </main>
    </>
  );
}
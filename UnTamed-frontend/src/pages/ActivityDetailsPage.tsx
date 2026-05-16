import { useEffect, useMemo, useState, useCallback, useRef, type CSSProperties } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import type { PublicSession, PublicTemplateCard } from "../types/activity";
import type { Review } from "../types/review";
import type { PaginatedResponse } from "../types/pagination";
import type { RecommendationItem, SimilarActivityItem } from "../types/recommendation";
import styles from "../style/activity-details.module.css";
import {
  getPublicActivityDetails,
  getPublicTemplateById,
  listPublicTemplateSessions,
} from "../api/activity.api";
import { getDailyForecast } from "../api/weather.api";
import { Header } from "../components/Header";
import { useAuth } from "../auth/auth.store";
import * as BookingApi from "../api/booking.api";
import * as ReviewApi from "../api/review.api";
import ReviewList from "../components/review/ReviewList";
import { getParticipantsPreview } from "../api/session.api";
import type { ParticipantsPreviewResponse } from "../types/participants";
import { WeatherWidget } from "../components/Weatherwidget";
import { BackButton } from "../components/BackButton";
import ChatAssistantWidget from "../components/assistant/ChatAssistantWidget";

type LoadState = "loading" | "error" | "done" | "notfound";
type BookingStep = "idle" | "selecting" | "confirming" | "success";
type SuggestionItem = RecommendationItem | SimilarActivityItem;

type SessionWeatherDay = {
  date: string;
  weatherCode: number;
  tempMax: number;
  tempMin: number;
  precipitationMax: number;
  windMax: number;
};

type SessionWeather = {
  mode: "single" | "range";
  days: SessionWeatherDay[];
};

function toDateOnlyLocal(value: string | Date) {
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return "";
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addDaysLocal(dateStr: string, days: number) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(y, (m ?? 1) - 1, d ?? 1);
  dt.setDate(dt.getDate() + days);
  return toDateOnlyLocal(dt);
}

function listDateRangeLocal(startDate: string, endDate: string) {
  if (!startDate || !endDate) return [];
  const out: string[] = [];
  let cursor = startDate;
  let guard = 0;
  while (cursor <= endDate && guard < 40) {
    out.push(cursor);
    cursor = addDaysLocal(cursor, 1);
    guard += 1;
  }
  return out;
}

function isSameLocalDate(startIso: string, endIso: string) {
  return toDateOnlyLocal(startIso) === toDateOnlyLocal(endIso);
}

function formatPrice(price: number) {
  if (Number.isNaN(price)) return "";
  return price === 0 ? "Free" : `${price} TND`;
}

function formatDateShort(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function formatDateCompact(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
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

function formatSessionDateLabel(startAt: string, endAt: string) {
  if (isSameLocalDate(startAt, endAt)) return formatDateShort(startAt);
  return `${formatDateCompact(startAt)} → ${formatDateShort(endAt)}`;
}

function formatSessionTimeLabel(startAt: string, endAt: string) {
  return `${formatTime(startAt)} - ${formatTime(endAt)}`;
}

function weatherCodeLabel(code: number) {
  if ([0, 1].includes(code)) return "clear";
  if ([2, 3].includes(code)) return "cloudy";
  if ([45, 48].includes(code)) return "foggy";
  if ([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return "rainy";
  if ([71, 73, 75, 77, 85, 86].includes(code)) return "snowy";
  if ([95, 96, 99].includes(code)) return "stormy";
  return "variable";
}

function summarizeSessionWeather(
  weather: SessionWeather | null,
  selectedSession: PublicSession | null,
  weatherLoading: boolean,
  weatherError: string | null,
  latitude: number | null,
  longitude: number | null
) {
  if (!selectedSession) return "No selected session yet, so session weather has not been loaded.";
  if (latitude == null || longitude == null) return "Weather unavailable because this activity has no valid coordinates.";
  if (weatherLoading) return "Weather forecast is still loading for the selected session.";
  if (!weather || weather.days.length === 0) {
    return weatherError
      ? `Weather forecast unavailable for the selected session: ${weatherError}.`
      : "Weather forecast unavailable for the selected session.";
  }
  const first = weather.days[0];
  const last = weather.days[weather.days.length - 1];
  const maxTemp = Math.round(Math.max(...weather.days.map((day) => day.tempMax)));
  const minTemp = Math.round(Math.min(...weather.days.map((day) => day.tempMin)));
  const maxRain = Math.round(Math.max(...weather.days.map((day) => day.precipitationMax)));
  const maxWind = Math.round(Math.max(...weather.days.map((day) => day.windMax)));
  const rangeLabel = weather.days.length === 1 ? first.date : `${first.date} to ${last.date}`;
  return `Selected session forecast for ${rangeLabel}: ${weatherCodeLabel(first.weatherCode)}, ${minTemp}-${maxTemp} C, precipitation probability up to ${maxRain}%, wind up to ${maxWind} km/h.`;
}

function parseCoordinate(value: unknown, min: number, max: number) {
  const parsed = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  return Number.isFinite(parsed) && parsed >= min && parsed <= max ? parsed : null;
}

function formatDurationLabel(startAt: string, endAt: string) {
  const start = new Date(startAt).getTime();
  const end = new Date(endAt).getTime();
  if (Number.isNaN(start) || Number.isNaN(end) || end <= start) return "—";

  const totalMinutes = Math.round((end - start) / 60000);
  const days = Math.floor(totalMinutes / (24 * 60));
  const hours = Math.floor((totalMinutes % (24 * 60)) / 60);
  const minutes = totalMinutes % 60;

  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0 && days === 0) parts.push(`${minutes}m`);
  return parts.join(" ") || "—";
}

const CARD_GRADIENTS = [
  "linear-gradient(135deg,#1a4d2e,#4d7c3f)",
  "linear-gradient(135deg,#2d5f3e,#ff8c42)",
  "linear-gradient(135deg,#1a3a4d,#2d7c6e)",
  "linear-gradient(135deg,#4d2e1a,#c4713a)",
  "linear-gradient(135deg,#2e1a4d,#7c3f7a)",
  "linear-gradient(135deg,#1a4d3e,#38a87a)",
];

function getBg(id: string) {
  const h = id.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  return CARD_GRADIENTS[h % CARD_GRADIENTS.length];
}

const DIFF_CONFIG: Record<string, { bg: string; color: string; label: string }> = {
  EASY: { bg: "#dcfce7", color: "#166534", label: "Easy" },
  MEDIUM: { bg: "#fef9c3", color: "#854d0e", label: "Medium" },
  HARD: { bg: "#fee2e2", color: "#991b1b", label: "Hard" },
};

function mapSuggestionToCard(item: SuggestionItem): PublicTemplateCard {
  return {
    id: item.templateId,
    title: item.title,
    description: item.description,
    difficulty: item.difficulty ?? "EASY",
    price: item.price ?? 0,
    coverImageUrl: item.coverImageUrl,
    categoryIds: item.categoryIds ?? [],
    tags: [],
    images: item.coverImageUrl
      ? [{ url: item.coverImageUrl, cover: true, order: 0, alt: item.title }]
      : [],
    rating: { average: item.ratingAverage ?? 0, count: item.ratingCount ?? 0 },
    nextSession: item.nextSessionDate
      ? { sessionId: `${item.templateId}-next`, date: item.nextSessionDate, capacity: 999, bookedCount: 0 }
      : null,
    upcomingSessionsCount: item.nextSessionDate ? 1 : 0,
    totalBookedCount: 0,
  } as PublicTemplateCard;
}

function CarouselCard({ activity }: { activity: PublicTemplateCard }) {
  const { id, title, difficulty, price, coverImageUrl, rating, nextSession } = activity;
  const avg = Number(rating?.average ?? 0);
  const cnt = Number(rating?.count ?? 0);
  const dk = ((difficulty ?? "EASY") as string).toUpperCase();
  const diff = DIFF_CONFIG[dk] ?? DIFF_CONFIG.EASY;

  const imgStyle: React.CSSProperties = coverImageUrl
    ? { backgroundImage: `url(${coverImageUrl})`, backgroundSize: "cover", backgroundPosition: "center" }
    : { background: getBg(id) };

  return (
    <Link to={`/activities/${id}`} className={styles.carouselCard}>
      <div className={styles.carouselCardImg} style={imgStyle}>
        <div className={styles.carouselImgOverlay} />
        <span className={styles.carouselDiffBadge} style={{ background: diff.bg, color: diff.color }}>
          {diff.label}
        </span>
        <span className={styles.carouselPriceTag}>
          {Number(price ?? 0) === 0 ? "Free" : `${price} TND`}
        </span>
      </div>
      <div className={styles.carouselCardBody}>
        <div className={styles.carouselCardTitle}>{title}</div>
        <div className={styles.carouselCardFoot}>
          <div className={styles.carouselRating}>
            <span className={styles.carouselStar}>★</span>
            <span className={styles.carouselRatingVal}>{avg > 0 ? avg.toFixed(1) : "New"}</span>
            {cnt > 0 && <span className={styles.carouselRatingCnt}>({cnt})</span>}
          </div>
          {nextSession?.date && (
            <span className={styles.carouselDate}>{formatDateCompact(nextSession.date)}</span>
          )}
        </div>
      </div>
    </Link>
  );
}

const SCROLL_AMT = 228;

function SuggestionCarousel({
  title,
  items,
  loading,
  emptyText,
}: {
  title: string;
  items: SuggestionItem[];
  loading: boolean;
  emptyText: string;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [canPrev, setCanPrev] = useState(false);
  const [canNext, setCanNext] = useState(false);
  const isDragging = useRef(false);
  const startX = useRef(0);
  const scrollX = useRef(0);

  const updateNav = useCallback(() => {
    const t = trackRef.current;
    if (!t) return;
    setCanPrev(t.scrollLeft > 0);
    setCanNext(t.scrollLeft + t.clientWidth < t.scrollWidth - 1);
  }, []);

  useEffect(() => {
    const t = trackRef.current;
    if (!t) return;
    t.addEventListener("scroll", updateNav, { passive: true });
    const ro = new ResizeObserver(updateNav);
    ro.observe(t);
    updateNav();
    return () => {
      t.removeEventListener("scroll", updateNav);
      ro.disconnect();
    };
  }, [updateNav, items]);

  function scrollBy(dir: 1 | -1) {
    trackRef.current?.scrollBy({ left: dir * SCROLL_AMT, behavior: "smooth" });
    setTimeout(updateNav, 320);
  }

  function onMouseDown(e: React.MouseEvent) {
    isDragging.current = true;
    startX.current = e.pageX - (trackRef.current?.offsetLeft ?? 0);
    scrollX.current = trackRef.current?.scrollLeft ?? 0;
    if (trackRef.current) trackRef.current.style.cursor = "grabbing";
  }

  function onMouseMove(e: React.MouseEvent) {
    if (!isDragging.current || !trackRef.current) return;
    e.preventDefault();
    const x = e.pageX - trackRef.current.offsetLeft;
    trackRef.current.scrollLeft = scrollX.current - (x - startX.current);
  }

  function onMouseUp() {
    isDragging.current = false;
    if (trackRef.current) trackRef.current.style.cursor = "grab";
  }

  return (
    <section className={styles.carouselSection}>
      <div className={styles.carouselHead}>
        <h2 className={styles.sectionTitle}>{title}</h2>
        <div className={styles.carouselHeadRight}>
          {!loading && items.length > 0 && (
            <span className={styles.carouselCountBadge}>{items.length} found</span>
          )}
          <div className={styles.carouselNavBtns}>
            <button
              className={styles.carouselNavBtn}
              onClick={() => scrollBy(-1)}
              disabled={!canPrev}
              type="button"
              aria-label="Scroll left"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <path d="M15 18l-6-6 6-6" />
              </svg>
            </button>
            <button
              className={styles.carouselNavBtn}
              onClick={() => scrollBy(1)}
              disabled={!canNext}
              type="button"
              aria-label="Scroll right"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <path d="M9 18l6-6-6-6" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className={styles.noDates}>
          <div className={styles.spinner} style={{ width: 18, height: 18 }} />
          <span>Loading {title.toLowerCase()}…</span>
        </div>
      ) : items.length === 0 ? (
        <div className={styles.noDates}>
          <IcoSparkle />
          <span>{emptyText}</span>
        </div>
      ) : (
        <div className={styles.carouselWrap}>
          <div
            ref={trackRef}
            className={styles.carouselTrack}
            onMouseDown={onMouseDown}
            onMouseMove={onMouseMove}
            onMouseUp={onMouseUp}
            onMouseLeave={onMouseUp}
          >
            {items.map((item, i) => (
              <div key={`${item.templateId}-${i}`} className={styles.carouselSnap}>
                <CarouselCard activity={mapSuggestionToCard(item)} />
              </div>
            ))}
          </div>
          <div className={styles.carouselFade} />
        </div>
      )}
    </section>
  );
}

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
    width="13"
    height="13"
    viewBox="0 0 24 24"
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

function ConfettiBurst() {
  const pieces = Array.from({ length: 18 }, (_, i) => i);
  const colors = ["#ff8c42", "#ffa566", "#1a4d2e", "#2d5f3e", "#fff176", "#f48fb1"];
  return (
    <div className={styles.confettiWrap} aria-hidden="true">
      {pieces.map((i) => (
        <div
          key={i}
          className={styles.confettiPiece}
          style={
            {
              "--angle": `${(i / pieces.length) * 360}deg`,
              "--dist": `${40 + Math.random() * 50}px`,
              "--color": colors[i % colors.length],
              "--delay": `${Math.random() * 0.2}s`,
              "--size": `${5 + Math.random() * 5}px`,
            } as CSSProperties
          }
        />
      ))}
    </div>
  );
}

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

function ReviewModal({
  open,
  mode,
  submitting,
  initialRating,
  initialComment,
  error,
  onClose,
  onSubmit,
}: ReviewModalProps) {
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
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.45)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
        padding: 16,
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 520,
          background: "#fff",
          borderRadius: 20,
          boxShadow: "0 20px 50px rgba(0,0,0,0.18)",
          padding: 24,
        }}
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
                  style={{
                    fontSize: 30,
                    lineHeight: 1,
                    background: "transparent",
                    border: "none",
                    cursor: submitting ? "default" : "pointer",
                    color: value <= rating ? "#f5a623" : "#d8cfc8",
                    padding: 0,
                  }}
                  aria-label={`Rate ${value} star${value > 1 ? "s" : ""}`}
                >
                  ★
                </button>
              );
            })}
          </div>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Tell people what made this activity special..."
            style={{
              width: "100%",
              minHeight: 120,
              resize: "vertical",
              borderRadius: 12,
              border: "1px solid #ddd2c8",
              padding: 12,
              fontSize: 14,
              outline: "none",
              color: "#1a1a1a",
              background: "#fffdfb",
              boxSizing: "border-box",
            }}
            disabled={submitting}
            maxLength={1000}
          />
          {error && <p style={{ marginTop: 10, color: "#b42318", fontWeight: 600, fontSize: 13 }}>{error}</p>}
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 16 }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: "9px 14px",
                borderRadius: 10,
                border: "1px solid #d8cfc8",
                background: "#fff",
                fontWeight: 700,
                cursor: submitting ? "default" : "pointer",
                fontSize: 13,
              }}
              disabled={submitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              style={{
                padding: "9px 14px",
                borderRadius: 10,
                border: "none",
                background: "#1a4d2e",
                color: "#fff",
                fontWeight: 700,
                cursor: submitting ? "default" : "pointer",
                opacity: submitting ? 0.7 : 1,
                fontSize: 13,
              }}
              disabled={submitting || !rating || !comment.trim()}
            >
              {submitting ? (mode === "edit" ? "Saving..." : "Posting...") : mode === "edit" ? "Save changes" : "Post review"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

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
            <Link to={`/users/${p.userId}`} className={styles.participantAvatar} aria-label={`View ${p.username}'s public profile`}>
              {p.profileImageUrl ? <img src={p.profileImageUrl} alt={p.username} /> : <span>{p.username.charAt(0).toUpperCase()}</span>}
            </Link>
            <Link to={`/users/${p.userId}`} className={styles.participantName}>{p.username}</Link>
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
  const [participantsPreviewSessionId, setParticipantsPreviewSessionId] = useState<string | null>(null);
  const [participantsLoading, setParticipantsLoading] = useState(false);
  const [people, setPeople] = useState(1);
  const [guestNames, setGuestNames] = useState<string[]>([]);
  const [bookingStep, setBookingStep] = useState<BookingStep>("idle");
  const [bookingError, setBookingError] = useState<string | null>(null);
  const [bookingSuccessId, setBookingSuccessId] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());
  const [myReview, setMyReview] = useState<Review | null>(null);
  const [reviewEligible, setReviewEligible] = useState(false);
  const [initialReviewsPage, setInitialReviewsPage] = useState<PaginatedResponse<Review> | null>(null);
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [reviewReloadKey, setReviewReloadKey] = useState(0);
  const [similarActivities, setSimilarActivities] = useState<SimilarActivityItem[]>([]);
  const [recommendedActivities, setRecommendedActivities] = useState<RecommendationItem[]>([]);
  const [loadingSimilar, setLoadingSimilar] = useState(true);
  const [loadingRecommended, setLoadingRecommended] = useState(true);
  const [weather, setWeather] = useState<SessionWeather | null>(null);
  const [weatherLoading, setWeatherLoading] = useState(false);
  const [weatherError, setWeatherError] = useState<string | null>(null);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(t);
  }, []);

  const tplAny = template as any;
  const templateId = tplAny?.id ?? null;
  const templateTitle = tplAny?.title ?? "";
  const templateDescription = tplAny?.description ?? "";
  const templateDifficulty = tplAny?.difficulty ?? "EASY";
  const templateTags: string[] = tplAny?.tags ?? [];
  const templatePrice = Number(tplAny?.price ?? 0);
  const templateImages = tplAny?.images ?? [];
  const coverImageUrl = tplAny?.coverImageUrl ?? null;
  const ratingAverage = Number(tplAny?.rating?.average ?? tplAny?.ratingAverage ?? 0);
  const ratingCount = Number(tplAny?.rating?.count ?? tplAny?.ratingCount ?? 0);
  const totalBooked = Number(tplAny?.totalBookedCount ?? 0);
  const upcomingSessionsCount = Number(tplAny?.upcomingSessionsCount ?? 0);
  const addressDisplayName = tplAny?.addressDisplayName ?? null;
  const governorate = tplAny?.governorate ?? null;
  const latitude = parseCoordinate(tplAny?.latitude, -90, 90);
  const longitude = parseCoordinate(tplAny?.longitude, -180, 180);
  const guide = tplAny?.guide ?? null;
  const loadAll = useCallback(async () => {
    if (!id) {
      setState("notfound");
      return;
    }
    setState("loading");
    setLoadingSimilar(true);
    setLoadingRecommended(true);
    try {
      const details = await getPublicActivityDetails(id);
      const tpl = details.template;
      const sess = details.upcomingSessions ?? [];

      setTemplate(tpl);
      setSessions(sess);
      setMyReview(details.currentUserReview?.myReview ?? null);
      setReviewEligible(Boolean(details.currentUserReview?.reviewEligible));
      setInitialReviewsPage(details.reviews ?? null);
      setSimilarActivities((details.similarActivities ?? []).filter((item) => item.templateId !== id));
      setRecommendedActivities((details.recommendations ?? []).filter((item) => item.templateId !== id));

      const tplNextSessionId = (tpl as any)?.nextSession?.id ?? (tpl as any)?.nextSession?.sessionId ?? null;
      const firstSessionId = sess?.[0]?.id ?? null;
      setSelectedSessionId(tplNextSessionId ?? firstSessionId);
      setParticipantsPreview(details.participantsPreview ?? null);
      setParticipantsPreviewSessionId((tplNextSessionId ?? firstSessionId) && details.participantsPreview ? (tplNextSessionId ?? firstSessionId) : null);
      setState("done");
    } catch (err: any) {
      try {
        const [tpl, sess] = await Promise.all([getPublicTemplateById(id), listPublicTemplateSessions(id)]);
        setTemplate(tpl);
        setSessions(sess ?? []);
        setMyReview(null);
        setReviewEligible(false);
        setInitialReviewsPage(null);
        setSimilarActivities([]);
        setRecommendedActivities([]);
        setParticipantsPreview(null);
        setParticipantsPreviewSessionId(null);
        const tplNextSessionId = (tpl as any)?.nextSession?.id ?? (tpl as any)?.nextSession?.sessionId ?? null;
        const firstSessionId = sess?.[0]?.id ?? null;
        setSelectedSessionId(tplNextSessionId ?? firstSessionId);
        setState("done");
      } catch (fallbackErr: any) {
        setState(String(fallbackErr?.message ?? err?.message ?? "").includes("404") ? "notfound" : "error");
      }
    } finally {
      setLoadingSimilar(false);
      setLoadingRecommended(false);
    }
  }, [id]);

  useEffect(() => {
    if (!authLoading) void loadAll();
  }, [authLoading, loadAll]);

  useEffect(() => {
    if (!selectedSessionId) {
      setParticipantsPreview(null);
      setParticipantsPreviewSessionId(null);
      return;
    }
    if (participantsPreview && participantsPreviewSessionId === selectedSessionId) {
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        setParticipantsLoading(true);
        const data = await getParticipantsPreview(selectedSessionId);
        if (!cancelled) {
          setParticipantsPreview(data);
          setParticipantsPreviewSessionId(selectedSessionId);
        }
      } catch {
        if (!cancelled) {
          setParticipantsPreview(null);
          setParticipantsPreviewSessionId(null);
        }
      } finally {
        if (!cancelled) setParticipantsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedSessionId, participantsPreview, participantsPreviewSessionId]);

  const selectedSession = useMemo(() => sessions.find((s) => s.id === selectedSessionId) ?? null, [sessions, selectedSessionId]);
  const spotsLeft = useMemo(() => (selectedSession ? Math.max(0, selectedSession.capacity - selectedSession.bookedCount) : null), [selectedSession]);
  const selectedSessionLabel = useMemo(() => {
    if (!selectedSession) return null;
    return `${formatSessionDateLabel(selectedSession.startAt, selectedSession.endAt)}, ${formatSessionTimeLabel(selectedSession.startAt, selectedSession.endAt)}`;
  }, [selectedSession]);
  const availabilityLabel = useMemo(() => {
    if (!selectedSession || spotsLeft == null) return null;
    return `${spotsLeft} of ${selectedSession.capacity} seats available`;
  }, [selectedSession, spotsLeft]);
  const weatherSummary = useMemo(
    () => summarizeSessionWeather(weather, selectedSession, weatherLoading, weatherError, latitude, longitude),
    [weather, selectedSession, weatherLoading, weatherError, latitude, longitude]
  );

  useEffect(() => {
    if (spotsLeft == null || spotsLeft <= 0) return;
    if (people > spotsLeft) setPeople(spotsLeft);
    if (people <= 0) setPeople(1);
  }, [spotsLeft, selectedSessionId, people]);

  useEffect(() => {
    setGuestNames((prev) => {
      const nextLength = Math.max(0, people - 1);
      if (prev.length === nextLength) return prev;
      return Array.from({ length: nextLength }, (_, i) => prev[i] ?? "");
    });
  }, [people]);

  useEffect(() => {
    let cancelled = false;

    async function loadWeather() {
      if (!selectedSession) {
        setWeather(null);
        setWeatherError(null);
        setWeatherLoading(false);
        return;
      }

      if (latitude == null || longitude == null) {
        setWeather(null);
        setWeatherError("Weather unavailable for this location");
        setWeatherLoading(false);
        return;
      }

      const startDay = toDateOnlyLocal(selectedSession.startAt);
      const endDay = toDateOnlyLocal(selectedSession.endAt || selectedSession.startAt);

      if (!startDay || !endDay) {
        setWeather(null);
        setWeatherError("Weather unavailable");
        setWeatherLoading(false);
        return;
      }

      try {
        setWeatherLoading(true);
        setWeatherError(null);

        const forecast = await getDailyForecast(latitude, longitude, 16);
        if (cancelled) return;

        const daily = forecast?.daily;
        const wantedDates = listDateRangeLocal(startDay, endDay);

        const matchedDays: SessionWeatherDay[] = wantedDates
          .map((date) => {
            const idx = daily?.time?.findIndex((t) => t === date) ?? -1;
            if (idx < 0) return null;
            return {
              date,
              weatherCode: Number(daily.weathercode[idx] ?? 0),
              tempMax: Number(daily.temperature_2m_max[idx] ?? 0),
              tempMin: Number(daily.temperature_2m_min[idx] ?? 0),
              precipitationMax: Number(daily.precipitation_probability_max[idx] ?? 0),
              windMax: Number(daily.windspeed_10m_max[idx] ?? 0),
            };
          })
          .filter((item): item is SessionWeatherDay => item !== null);

        if (matchedDays.length === 0) {
          setWeather(null);
          setWeatherError("selected session date is outside the 16-day Open-Meteo forecast range");
          return;
        }

        setWeather({
          mode: matchedDays.length === 1 ? "single" : "range",
          days: matchedDays,
        });
      } catch {
        if (!cancelled) {
          setWeather(null);
          setWeatherError("Could not load weather");
        }
      } finally {
        if (!cancelled) setWeatherLoading(false);
      }
    }

    loadWeather();
    return () => {
      cancelled = true;
    };
  }, [selectedSession, latitude, longitude]);

  const allImages = useMemo(() => {
    if (!template) return [];
    if (templateImages.length > 0) return templateImages;
    if (coverImageUrl) return [{ url: coverImageUrl, cover: true, order: 0, alt: templateTitle }];
    return [];
  }, [template, templateImages, coverImageUrl, templateTitle]);

  const guideOwnerId = useMemo(() => ((selectedSession as any)?.guideId ?? tplAny?.guideId ?? guide?.id ?? null) as string | null, [selectedSession, tplAny, guide]);
  const isGuideOwner = useMemo(() => !!(user && guideOwnerId && user.id === guideOwnerId), [user, guideOwnerId]);

  const cutoffMs = useMemo(() => {
    if (!selectedSession) return null;
    const start = new Date(selectedSession.startAt).getTime();
    if (Number.isNaN(start)) return null;
    return start - now;
  }, [selectedSession, now]);

  const isWithinCutoff = useMemo(() => cutoffMs !== null && cutoffMs < 5 * 3600000, [cutoffMs]);
  const isWarnCutoff = useMemo(() => cutoffMs !== null && cutoffMs >= 0 && cutoffMs < 8 * 3600000 && !isWithinCutoff, [cutoffMs, isWithinCutoff]);

  const canBook = useMemo(() => {
    if (authLoading || !user || !selectedSessionId || !selectedSession) return false;
    if ((spotsLeft ?? 0) <= 0 || isGuideOwner || isWithinCutoff) return false;
    return true;
  }, [authLoading, user, selectedSessionId, selectedSession, spotsLeft, isGuideOwner, isWithinCutoff]);

  const totalPrice = templatePrice * people;

  const mostBookedSessionId = useMemo(() => {
    if (!sessions.length) return null;
    return sessions.reduce((a, b) => (b.bookedCount > a.bookedCount ? b : a)).id;
  }, [sessions]);

  const canWriteOrEditReview = !!user && !isGuideOwner && !!template && (reviewEligible || !!myReview);

  const openReviewModal = useCallback(() => {
    setReviewError(null);
    setReviewModalOpen(true);
  }, []);

  async function onBook() {
    if (!canBook || !selectedSessionId || !id) return;
    setBookingError(null);

    const trimmedGuestNames = guestNames.map((name) => name.trim());
    if (people > 1) {
      if (trimmedGuestNames.length !== people - 1 || trimmedGuestNames.some((name) => !name)) {
        setBookingError("Please enter a name for every guest.");
        return;
      }
    }

    setBookingStep("confirming");
    try {
      const res = await BookingApi.createOrIncreaseBooking({
        sessionId: selectedSessionId,
        numberOfPeople: people,
        guestNames: people > 1 ? trimmedGuestNames : [],
      });
      setBookingSuccessId(res.id);
      setBookingStep("success");
      await refreshMe();
      const sess = await listPublicTemplateSessions(id);
      setSessions(sess ?? []);
      const refreshedSelected = sess?.find((session) => session.id === selectedSessionId)?.id ?? sess?.[0]?.id ?? null;
      setSelectedSessionId(refreshedSelected);
      if (refreshedSelected) {
        try {
          setParticipantsLoading(true);
          const preview = await getParticipantsPreview(refreshedSelected);
          setParticipantsPreview(preview);
          setParticipantsPreviewSessionId(refreshedSelected);
        } catch {
          setParticipantsPreview(null);
          setParticipantsPreviewSessionId(null);
        } finally {
          setParticipantsLoading(false);
        }
      }
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
    if (!templateId) return;
    setReviewError(null);
    setReviewSubmitting(true);
    try {
      if (myReview?.id) {
        await ReviewApi.updateReview(myReview.id, payload);
      } else {
        await ReviewApi.createReviewForTemplate(templateId, payload);
      }
      setReviewModalOpen(false);
      const details = await getPublicActivityDetails(templateId);
      setTemplate(details.template);
      setMyReview(details.currentUserReview?.myReview ?? null);
      setReviewEligible(Boolean(details.currentUserReview?.reviewEligible));
      setInitialReviewsPage(details.reviews ?? null);
      setReviewReloadKey((v) => v + 1);
    } catch (err: any) {
      setReviewError(err?.response?.data?.message || err?.message || "Failed to submit review.");
    } finally {
      setReviewSubmitting(false);
    }
  }

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
            {state === "notfound" ? (
              <Link to="/home" className={styles.btnPrimary}>Explore Adventures</Link>
            ) : (
              <button className={styles.btnPrimary} onClick={() => nav(0)} type="button">Try Again</button>
            )}
          </div>
        </main>
      </>
    );
  }

  const safeDiff = templateDifficulty;

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
        onClose={() => {
          if (!reviewSubmitting) {
            setReviewModalOpen(false);
            setReviewError(null);
          }
        }}
        onSubmit={handleReviewSubmit}
      />

      {participantsModalOpen && participantsPreview && participantsPreview.totalConfirmed > 0 && (
        <ParticipantsModal preview={participantsPreview} onClose={() => setParticipantsModalOpen(false)} />
      )}

      {galleryOpen && allImages.length > 0 && (
        <div className={styles.lightboxOverlay} onClick={() => setGalleryOpen(false)}>
          <button className={styles.lightboxClose} onClick={() => setGalleryOpen(false)} type="button">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
          <button
            className={`${styles.lightboxNav} ${styles.lbPrev}`}
            onClick={(e) => {
              e.stopPropagation();
              setActiveImageIdx((i) => (i - 1 + allImages.length) % allImages.length);
            }}
            type="button"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
          <img src={allImages[activeImageIdx]?.url} alt={allImages[activeImageIdx]?.alt ?? ""} className={styles.lightboxImg} onClick={(e) => e.stopPropagation()} />
          <button
            className={`${styles.lightboxNav} ${styles.lbNext}`}
            onClick={(e) => {
              e.stopPropagation();
              setActiveImageIdx((i) => (i + 1) % allImages.length);
            }}
            type="button"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M9 18l6-6-6-6" />
            </svg>
          </button>
          <div className={styles.lightboxCounter}>
            {activeImageIdx + 1} / {allImages.length}
          </div>
        </div>
      )}

      <main className={styles.detailsRoot}>
        <div className={styles.topBar}>
          <BackButton
            fallbackTo="/home"
            label="Back to adventures"
            className={styles.backBtn}
            variant="plain"
          />
        </div>

        <div className={styles.pageWrapper}>
          <div className={styles.contentGrid}>
            <div className={styles.leftCol}>
              <div className={styles.titleBlock}>
                <div className={styles.badgeRow}>
                  <span className={`${styles.diffBadge} ${styles[`diff${safeDiff}`]}`}>
                    <IcoMountain /> {DIFF_LABELS[safeDiff] ?? safeDiff}
                  </span>
                  {templateTags.slice(0, 3).map((t: string) => (
                    <span key={t} className={styles.tagChip}>
                      <IcoTag /> {t}
                    </span>
                  ))}
                </div>
                <h1 className={styles.activityTitle}>{templateTitle}</h1>
                <div className={styles.metaRow}>
                  <StarRating average={ratingAverage} count={ratingCount} />
                  <span className={styles.dot}>·</span>
                  {totalBooked > 0 ? (
                    <span className={styles.bookedPill}>
                      <IcoTrend /> {totalBooked} booked
                    </span>
                  ) : (
                    <span className={styles.firstPill}>
                      <IcoSparkle /> Be the first to book
                    </span>
                  )}
                  {upcomingSessionsCount > 0 && (
                    <>
                      <span className={styles.dot}>·</span>
                      <span className={styles.metaText}>{upcomingSessionsCount} upcoming dates</span>
                    </>
                  )}
                </div>
              </div>

              {allImages.length > 1 ? (
                <div className={styles.heroGallery}>
                  <div
                    className={styles.heroMain}
                    onClick={() => {
                      setActiveImageIdx(0);
                      setGalleryOpen(true);
                    }}
                  >
                    <img src={allImages[0]?.url} alt={allImages[0]?.alt ?? templateTitle} />
                  </div>
                  <div className={styles.heroThumbsCol}>
                    {allImages.slice(1, 3).map((img: any, idx: number) => (
                      <div
                        key={img.url}
                        className={styles.heroThumb}
                        onClick={() => {
                          setActiveImageIdx(idx + 1);
                          setGalleryOpen(true);
                        }}
                      >
                        <img src={img.url} alt={img.alt ?? ""} />
                        {idx === 1 && allImages.length > 3 && <div className={styles.moreOverlay}>+{allImages.length - 3}</div>}
                      </div>
                    ))}
                  </div>
                  <button
                    className={styles.viewAllBtn}
                    onClick={() => {
                      setActiveImageIdx(0);
                      setGalleryOpen(true);
                    }}
                    type="button"
                  >
                    <IcoPhoto /> Show all {allImages.length} photos
                  </button>
                </div>
              ) : allImages.length === 1 ? (
                <div
                  className={styles.heroSingle}
                  onClick={() => {
                    setActiveImageIdx(0);
                    setGalleryOpen(true);
                  }}
                >
                  <img src={allImages[0]?.url} alt={allImages[0]?.alt ?? templateTitle} />
                </div>
              ) : null}

              <div className={styles.divider} />

              <section className={styles.datesSection}>
                <div className={styles.datesSectionHead}>
                  <h2 className={styles.sectionTitle}>Available dates</h2>
                  {sessions.length > 0 && (
                    <span className={styles.datesCountBadge}>
                      {sessions.length} date{sessions.length !== 1 ? "s" : ""}
                    </span>
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
                            <span className={styles.popularBadge}>
                              <IcoFire /> Popular
                            </span>
                          )}
                          {active && (
                            <span className={styles.sessionCheckmark}>
                              <IcoCheck />
                            </span>
                          )}
                          {scarce && !soldOut && <span className={styles.scarcePulse} />}
                          <div className={styles.sessionDateLine}>{formatSessionDateLabel(s.startAt, s.endAt)}</div>
                          <div className={styles.sessionTimeLine}>{formatSessionTimeLabel(s.startAt, s.endAt)}</div>
                          <div className={styles.sessionSpotsLine}>
                            {soldOut ? (
                              <span className={styles.tagSoldOut}>Sold out</span>
                            ) : scarce ? (
                              <span className={styles.tagScarce}>{left} spot{left > 1 ? "s" : ""} left</span>
                            ) : (
                              <span className={styles.tagOk}>
                                {left}/{s.capacity} spots
                              </span>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </section>

              <div className={styles.divider} />

              {guide && (
                <div className={styles.guideCard}>
                  <div className={styles.guideAvatarWrap}>
                    <Link to={`/users/${guide.id}`} aria-label={`View ${guide.username}'s public profile`}>
                      {guide.profileImageUrl ? (
                        <img src={guide.profileImageUrl} alt={guide.username} className={styles.guideImg} />
                      ) : (
                        <div className={styles.guidePlaceholder}>{String(guide.username ?? "?")[0].toUpperCase()}</div>
                      )}
                    </Link>
                    {guide.verifiedBadge && (
                      <div className={styles.guideBadgeRing}>
                        <IcoShield />
                      </div>
                    )}
                  </div>
                  <div className={styles.guideInfo}>
                    <div className={styles.guideLabel}>Your guide</div>
                    <div className={styles.guideName}>
                      <Link to={`/users/${guide.id}`} className={styles.guideProfileLink}>
                        {guide.username}
                      </Link>
                      {guide.verifiedBadge && (
                        <span className={styles.verifiedChip}>
                          <IcoCheck /> Verified
                        </span>
                      )}
                    </div>
                    <div className={styles.guideMeta}>
                      {guide.experienceYears != null && <span>{guide.experienceYears} yrs experience</span>}
                      {(guide.rating?.count ?? 0) > 0 && (
                        <>
                          <span className={styles.dot}>·</span>
                          <span>
                            {Number(guide.rating.average).toFixed(1)} rating ({guide.rating.count})
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              )}

              <div className={styles.divider} />

              <section className={styles.section}>
                <h2 className={styles.sectionTitle}>About this adventure</h2>
                <p className={styles.description}>{templateDescription}</p>
              </section>

              <div className={styles.quickGrid}>
                <div className={styles.quickItem}>
                  <div className={styles.quickIcon}>
                    <IcoMountain />
                  </div>
                  <div>
                    <div className={styles.quickLabel}>Difficulty</div>
                    <div className={styles.quickVal}>{DIFF_LABELS[safeDiff] ?? safeDiff}</div>
                  </div>
                </div>
                <div className={styles.quickItem}>
                  <div className={styles.quickIcon}>
                    <IcoDollar />
                  </div>
                  <div>
                    <div className={styles.quickLabel}>Price</div>
                    <div className={styles.quickVal}>{formatPrice(templatePrice)}</div>
                  </div>
                </div>
                {selectedSession && (
                  <div className={styles.quickItem}>
                    <div className={styles.quickIcon}>
                      <IcoClock />
                    </div>
                    <div>
                      <div className={styles.quickLabel}>Duration</div>
                      <div className={styles.quickVal}>{formatDurationLabel(selectedSession.startAt, selectedSession.endAt)}</div>
                    </div>
                  </div>
                )}
                {addressDisplayName && (
                  <div className={styles.quickItem}>
                    <div className={styles.quickIcon}>
                      <IcoMapPin />
                    </div>
                    <div>
                      <div className={styles.quickLabel}>Location</div>
                      <div className={styles.quickVal}>{governorate ?? addressDisplayName}</div>
                    </div>
                  </div>
                )}
              </div>

              <div className={styles.divider} />

              {addressDisplayName && (
                <section className={styles.section}>
                  <h2 className={styles.sectionTitle}>Meeting point</h2>
                  <div className={styles.locationCard}>
                    <div className={styles.locationIconBox}>
                      <IcoMapPin />
                    </div>
                    <div>
                      <div className={styles.locationName}>{addressDisplayName}</div>
                      {governorate && <div className={styles.locationSub}>{governorate}</div>}
                      {latitude != null && longitude != null && (
                        <a href={`https://www.google.com/maps?q=${latitude},${longitude}`} target="_blank" rel="noopener noreferrer" className={styles.mapLink}>
                          View on Google Maps <IcoLink />
                        </a>
                      )}
                    </div>
                  </div>
                </section>
              )}

              <div className={styles.divider} />

              <section className={styles.section} id="reviews-section">
                {!user && <p className={styles.noCharge} style={{ marginBottom: 14 }}>Login to write a review.</p>}
                {user && isGuideOwner && <p className={styles.noCharge} style={{ marginBottom: 14 }}>Guides cannot review their own activity.</p>}
                <ReviewList
                  key={reviewReloadKey}
                  templateId={templateId}
                  currentUserId={user?.id ?? null}
                  guideOwnerId={guideOwnerId}
                  canReview={canWriteOrEditReview}
                  userReviewId={myReview?.id ?? null}
                  onEditMyReview={canWriteOrEditReview ? openReviewModal : undefined}
                  initialReviewsPage={initialReviewsPage}
                />
              </section>

              <div className={styles.divider} />

              <SuggestionCarousel
                title="Similar experiences"
                items={similarActivities}
                loading={loadingSimilar}
                emptyText="No similar activities found yet."
              />

              <div className={styles.divider} />

              <SuggestionCarousel
                title="You may also like"
                items={recommendedActivities}
                loading={loadingRecommended}
                emptyText="No recommendations available right now."
              />

              <div style={{ height: 48 }} />
            </div>

            <aside className={styles.sidebar}>
              <div className={styles.sidebarCard}>
                {bookingStep === "success" && bookingSuccessId ? (
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
                      <strong>{selectedSession ? formatSessionDateLabel(selectedSession.startAt, selectedSession.endAt) : "your adventure"}</strong>
                    </p>
                    {templatePrice > 0 && (
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
                      onClick={() => {
                        setBookingStep("idle");
                        setBookingSuccessId(null);
                      }}
                    >
                      Book another date
                    </button>
                  </div>
                ) : (
                  <>
                    <div className={styles.sidebarTop}>
                      <span className={styles.sidebarPrice}>{formatPrice(templatePrice)}</span>
                      {templatePrice > 0 && <span className={styles.sidebarPriceUnit}> / person</span>}
                    </div>

                    <StarRating average={ratingAverage} count={ratingCount} />
                    <div className={styles.sidebarDivider} />

                    {isWarnCutoff && cutoffMs !== null && (
                      <div className={styles.cutoffWarning}>
                        <IcoClock />
                        <span>
                          Booking closes in <strong>{formatCountdown(cutoffMs)}</strong> — book soon!
                        </span>
                      </div>
                    )}

                    <div className={styles.sidebarFields}>
                      <div className={styles.sidebarField}>
                        <span className={styles.sidebarFieldLabel}>
                          <IcoCalendar /> Dates
                        </span>
                        <span className={styles.sidebarFieldVal}>
                          {selectedSession ? formatSessionDateLabel(selectedSession.startAt, selectedSession.endAt) : "—"}
                        </span>
                      </div>

                      {selectedSession && (
                        <div className={styles.sidebarField}>
                          <span className={styles.sidebarFieldLabel}>
                            <IcoClock /> Time
                          </span>
                          <span className={styles.sidebarFieldVal}>{formatSessionTimeLabel(selectedSession.startAt, selectedSession.endAt)}</span>
                        </div>
                      )}

                      {selectedSession && (
                        <div className={styles.sidebarField}>
                          <span className={styles.sidebarFieldLabel}>
                            <IcoClock /> Duration
                          </span>
                          <span className={styles.sidebarFieldVal}>{formatDurationLabel(selectedSession.startAt, selectedSession.endAt)}</span>
                        </div>
                      )}

                      <div className={styles.sidebarField}>
                        <span className={styles.sidebarFieldLabel}>
                          <IcoUsers /> Availability
                        </span>
                        <span className={styles.sidebarFieldVal}>
                          {spotsLeft == null ? (
                            "—"
                          ) : spotsLeft === 0 ? (
                            <span className={styles.tagSoldOut}>Sold out</span>
                          ) : spotsLeft <= 3 ? (
                            <span className={styles.tagScarce}>{spotsLeft} spots left</span>
                          ) : (
                            `${spotsLeft} spots`
                          )}
                        </span>
                      </div>

                      <div className={styles.sidebarField}>
                        <span className={styles.sidebarFieldLabel}>
                          <IcoUsers /> Guests
                        </span>
                        <div className={styles.peopleStepper}>
                          <button
                            className={styles.stepperBtn}
                            type="button"
                            onClick={() => setPeople((p) => Math.max(1, p - 1))}
                            disabled={people <= 1 || !selectedSession || (spotsLeft ?? 0) <= 0}
                          >
                            −
                          </button>
                          <span className={styles.stepperVal}>{people}</span>
                          <button
                            className={styles.stepperBtn}
                            type="button"
                            onClick={() => setPeople((p) => Math.min(Math.min(10, spotsLeft ?? 10), p + 1))}
                            disabled={people >= Math.min(10, spotsLeft ?? 10) || !selectedSession || (spotsLeft ?? 0) <= 0}
                          >
                            +
                          </button>
                        </div>
                      </div>
                    </div>

                    {people > 1 && (
                      <div className={styles.guestNameFields}>
                        <div className={styles.guestNameIntro}>
                          <strong>Friend names</strong>
                          <span>The main booker is pass 1. Add names for the other passes.</span>
                        </div>
                        {guestNames.map((name, index) => (
                          <label className={styles.guestNameField} key={index}>
                            <span>Guest {index + 2} name</span>
                            <input
                              type="text"
                              value={name}
                              maxLength={80}
                              placeholder="Friend name"
                              onChange={(event) => {
                                const value = event.target.value;
                                setGuestNames((prev) => prev.map((item, i) => (i === index ? value : item)));
                              }}
                            />
                          </label>
                        ))}
                      </div>
                    )}

                    {!selectedSession ? (
                      <div className={styles.weatherSection} style={{ marginTop: 14 }}>
                        <div className={styles.weatherLoading}>Select a session to see the forecast.</div>
                      </div>
                    ) : weatherLoading ? (
                      <div className={styles.weatherSection} style={{ marginTop: 14 }}>
                        <div className={styles.weatherLoading}>
                          <div className={styles.spinner} style={{ width: 16, height: 16 }} />
                          <span>Loading forecast...</span>
                        </div>
                      </div>
                    ) : weather ? (
                      <div className={styles.weatherSection} style={{ marginTop: 14 }}>
                        <WeatherWidget
                          weather={weather}
                          location={addressDisplayName ?? governorate ?? undefined}
                          activityDateLabel={formatSessionDateLabel(selectedSession.startAt, selectedSession.endAt)}
                        />
                      </div>
                    ) : (
                      <div className={styles.weatherSection} style={{ marginTop: 14 }}>
                        <div className={styles.weatherLoading}>{weatherError ?? "Forecast not available yet."}</div>
                      </div>
                    )}

                    {templatePrice > 0 && selectedSession && (spotsLeft ?? 0) > 0 && (
                      <div className={styles.priceSummary}>
                        <div className={styles.priceSummaryRow}>
                          <span>
                            {templatePrice} TND × {people} {people === 1 ? "person" : "people"}
                          </span>
                          <span>{templatePrice * people} TND</span>
                        </div>
                        <div className={styles.priceSummaryTotal}>
                          <span>Total</span>
                          <span className={styles.priceSummaryTotalAmt}>{totalPrice} TND</span>
                        </div>
                      </div>
                    )}

                    <div className={styles.sidebarBookedRow}>
                      {totalBooked > 0 ? (
                        <span className={styles.bookedPill}>
                          <IcoTrend /> {totalBooked} people booked this
                        </span>
                      ) : (
                        <span className={styles.firstPill}>
                          <IcoSparkle /> Be the first to book
                        </span>
                      )}
                    </div>

                    <button
                      className={`${styles.bookBtn} ${bookingStep === "confirming" ? styles.bookBtnLoading : ""}`}
                      type="button"
                      disabled={!canBook || bookingStep === "confirming"}
                      onClick={onBook}
                    >
                      {bookingStep === "confirming" ? (
                        <>
                          <div className={styles.bookBtnSpinner} />
                          <span>Confirming...</span>
                        </>
                      ) : (
                        <span>
                          Book This Adventure
                          {templatePrice > 0 && selectedSession && (spotsLeft ?? 0) > 0 ? ` · ${totalPrice} TND` : ""}
                        </span>
                      )}
                    </button>

                    {!authLoading && !user && <p className={styles.noCharge}>Login to book</p>}
                    {user && isGuideOwner && <p className={styles.noCharge}>You can't book your own activity.</p>}
                    {user && isWithinCutoff && (
                      <p className={styles.noCharge} style={{ color: "#c4360c" }}>
                        ⏰ Booking closed — starts within 5 hours.
                      </p>
                    )}
                    {bookingError && <p className={styles.bookingError}>{bookingError}</p>}
                    {!bookingError && !isWithinCutoff && <p className={styles.noCharge}>You won't be charged yet</p>}

                    <div className={styles.sidebarDivider} />

                    <div className={styles.whoJoining}>
                      {participantsLoading ? (
                        <p className={styles.noCharge}>Loading participants...</p>
                      ) : !participantsPreview || participantsPreview.totalConfirmed === 0 ? (
                        <p className={styles.noCharge}>Be the first to join this adventure.</p>
                      ) : (
                        <div className={styles.whoJoiningInner}>
                          <div className={styles.avatarStack}>
                            {participantsPreview.participants.slice(0, 4).map((p) => (
                              <Link
                                key={p.userId}
                                to={`/users/${p.userId}`}
                                className={styles.avatar}
                                title={p.username}
                                aria-label={`View ${p.username}'s public profile`}
                              >
                                {p.profileImageUrl ? <img src={p.profileImageUrl} alt={p.username} /> : <span>{p.username.charAt(0).toUpperCase()}</span>}
                              </Link>
                            ))}
                            {participantsPreview.totalConfirmed > 4 && <div className={styles.moreAvatar}>+{participantsPreview.totalConfirmed - 4}</div>}
                          </div>

                          <div className={styles.whoJoiningText}>
                            <div className={styles.whoJoiningCount}>{participantsPreview.totalConfirmed} joined already</div>
                            {participantsPreview.seatsLeft != null && (
                              <div className={styles.whoJoiningSeats}>
                                {participantsPreview.seatsLeft} seat{participantsPreview.seatsLeft !== 1 ? "s" : ""} left
                              </div>
                            )}
                          </div>

                          <button className={styles.viewAllBtn2} type="button" onClick={() => setParticipantsModalOpen(true)}>
                            View all
                          </button>
                        </div>
                      )}
                    </div>

                    {guide && (
                      <div className={styles.sidebarGuide}>
                        <Link to={`/users/${guide.id}`} aria-label={`View ${guide.username}'s public profile`}>
                          {guide.profileImageUrl ? (
                            <img src={guide.profileImageUrl} alt={guide.username} className={styles.sidebarGuideImg} />
                          ) : (
                            <div className={styles.sidebarGuidePlaceholder}>{String(guide.username ?? "?")[0].toUpperCase()}</div>
                          )}
                        </Link>
                        <div>
                          <div className={styles.sidebarGuideLabel}>Guided by</div>
                          <Link to={`/users/${guide.id}`} className={styles.sidebarGuideName}>{guide.username}</Link>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </aside>
          </div>
        </div>
        {user && (
          <ChatAssistantWidget
            activityTemplateId={templateId}
            sessionId={selectedSessionId}
            activityTitle={templateTitle}
            difficulty={templateDifficulty}
            tags={templateTags}
            price={templatePrice}
            location={addressDisplayName ?? governorate ?? null}
            selectedSessionLabel={selectedSessionLabel}
            availabilityLabel={availabilityLabel}
            weatherSummary={weatherSummary}
            mode="activity"
          />
        )}
      </main>
    </>
  );
}

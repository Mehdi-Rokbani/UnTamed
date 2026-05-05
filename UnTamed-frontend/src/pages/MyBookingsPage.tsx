// src/pages/MyBookingsPage.tsx
import { forwardRef, useCallback, useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { Link } from "react-router-dom";
import { MapContainer, Marker, Popup, TileLayer, useMap } from "react-leaflet";
import { QRCodeCanvas } from "qrcode.react";
import L from "leaflet";
import { Header } from "../components/Header";
import ReviewForm from "../components/review/ReviewForm";
import { useAuth } from "../auth/auth.store";
import * as BookingApi from "../api/booking.api";
import type { BookingWithDetails } from "../api/booking.api";
import type { RefundPreviewResponse, RefundStatus } from "../api/booking.api";
import * as GuestPassApi from "../api/guestPass.api";
import type { GuestPass } from "../api/guestPass.api";
import * as ReviewApi from "../api/review.api";
import * as GuideReviewApi from "../api/guideReview.api";
import type { GuideReviewEligibility } from "../api/guideReview.api";
import styles from "../style/my-bookings.module.css";

import "leaflet/dist/leaflet.css";
delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl:       "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl:     "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

// ─── Types ──────────────────────────────────────────────────────────────────────
type LoadState   = "loading" | "done" | "error";
type ViewMode    = "map" | "list";
type ToastTone   = "success" | "error" | "info";
type DisplayStatus =
  | "UPCOMING"
  | "PENDING_PAYMENT"
  | "PAYING"
  | "COMPLETED"
  | "CANCELLED"
  | "EXPIRED";

function getDisplayStatus(b: BookingWithDetails): DisplayStatus {
  const sessionDate = b.sessionStartAt ? new Date(b.sessionStartAt) : null;
  const isFuture = sessionDate ? sessionDate.getTime() > Date.now() : false;

  if (b.status === "COMPLETED" && isFuture) {
    return "UPCOMING";
  }

  if (b.status === "COMPLETED") {
    return "COMPLETED";
  }

  if (b.status === "PENDING") {
    return "PENDING_PAYMENT";
  }

  if (b.status === "PAYING") {
    return "PAYING";
  }

  if (b.status === "CANCELLED") {
    return "CANCELLED";
  }

  if (b.status === "EXPIRED") {
    return "EXPIRED";
  }

  return "EXPIRED";
}

// ─── Status config (raw API statuses) ────────────────────────────────────────
type FilterKey = "ALL" | "UPCOMING" | "CONFIRMED" | "HISTORY";

// Display-status config (what we actually show in UI)
const DISPLAY_STATUS_CONFIG: Record<DisplayStatus, {
  label: string; color: string; bg: string; border: string; pin: string;
}> = {
  UPCOMING:        { label: "Upcoming",            color: "#ea580c", bg: "rgba(234,88,12,0.09)",   border: "rgba(234,88,12,0.22)",   pin: "#f97316" },
  PENDING_PAYMENT: { label: "Pending payment",     color: "#d97706", bg: "rgba(217,119,6,0.09)",   border: "rgba(217,119,6,0.22)",   pin: "#f59e0b" },
  PAYING:          { label: "Payment in progress", color: "#b45309", bg: "rgba(180,83,9,0.08)",    border: "rgba(180,83,9,0.18)",    pin: "#f59e0b" },
  COMPLETED:       { label: "Completed",           color: "#4b7a5e", bg: "rgba(75,122,94,0.09)",   border: "rgba(75,122,94,0.20)",   pin: "#6b9e80" },
  CANCELLED:       { label: "Cancelled",           color: "#dc2626", bg: "rgba(220,38,38,0.08)",   border: "rgba(220,38,38,0.18)",   pin: "#dc2626" },
  EXPIRED:         { label: "Expired",             color: "#64748b", bg: "rgba(100,116,139,0.09)", border: "rgba(100,116,139,0.18)", pin: "#94a3b8" },
};

function getDisplayCfg(ds: DisplayStatus) {
  return DISPLAY_STATUS_CONFIG[ds] ?? DISPLAY_STATUS_CONFIG.EXPIRED;
}

// ─── Sidebar section groups (ordered by priority) ────────────────────────────
const SECTION_GROUPS: Array<{
  id: string;
  label: string;
  displayStatuses: DisplayStatus[];
  isPaying?: boolean;
}> = [
  { id: "paying",    label: "In progress",         displayStatuses: ["PAYING"],                          isPaying: true },
  { id: "upcoming",  label: "Upcoming trips",       displayStatuses: ["UPCOMING", ]           },
  { id: "pending",   label: "Awaiting payment",     displayStatuses: ["PENDING_PAYMENT"]                 },
  { id: "completed", label: "Completed",            displayStatuses: ["COMPLETED"]                       },
  { id: "history",   label: "Expired & cancelled",  displayStatuses: ["CANCELLED", "EXPIRED"]            },
];

// ─── Filter chips ─────────────────────────────────────────────────────────────
const FILTER_OPTIONS: Array<{ key: FilterKey; label: string }> = [
  { key: "ALL",       label: "All"       },
  { key: "UPCOMING",  label: "Upcoming"  },
  { key: "CONFIRMED", label: "Confirmed" },
  { key: "HISTORY",   label: "History"   },
];

// ─── Map: which display statuses appear on map ────────────────────────────────
const DEFAULT_MAP_DISPLAY_STATUSES = new Set<DisplayStatus>(["UPCOMING", "COMPLETED"]);

// ─── Custom Leaflet pins ─────────────────────────────────────────────────────
function createPin(color: string, selected = false, dimmed = false): L.DivIcon {
  const size   = selected ? 44 : 32;
  const h      = size * 1.25;
  const shadow = selected
    ? `drop-shadow(0 4px 16px ${color}bb)`
    : "drop-shadow(0 2px 8px rgba(0,0,0,0.30))";
  const ring = selected ? `
    <div style="
      position:absolute;inset:-10px;border-radius:50%;
      border:2.5px solid ${color};opacity:.5;
      animation:pinPulse 1.8s ease-out infinite;pointer-events:none;
    "></div>` : "";
  return L.divIcon({
    className: "",
    iconAnchor:  [size / 2, size],
    popupAnchor: [0, -size - 4],
    html: `
      <div style="position:relative;width:${size}px;height:${h}px;
                  opacity:${dimmed ? 0.25 : 1};transition:opacity .2s;">
        ${ring}
        <svg viewBox="0 0 32 40" xmlns="http://www.w3.org/2000/svg"
             width="${size}" height="${h}"
             style="filter:${shadow};display:block;">
          <path d="M16 0C9.37 0 4 5.37 4 12c0 9.6 12 28 12 28S28 21.6 28 12C28 5.37 22.63 0 16 0z"
                fill="${color}"/>
          <circle cx="16" cy="12" r="5.5" fill="white" fill-opacity="0.92"/>
        </svg>
      </div>`,
  });
}

// ─── Map fly-to helper ───────────────────────────────────────────────────────
function FlyTo({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap();
  useEffect(() => { map.flyTo([lat, lng], 11, { duration: 1.2 }); }, [lat, lng, map]);
  return null;
}

// ─── Utilities ───────────────────────────────────────────────────────────────
function fmtDate(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("en-US", {
    weekday: "short", month: "short", day: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function timeCountdown(iso?: string | null): string | null {
  if (!iso) return null;
  const diff = new Date(iso).getTime() - Date.now();
  if (diff <= 0) return null;
  const days = Math.floor(diff / 86_400_000);
  if (days > 0) return `${days}d away`;
  const hrs = Math.floor(diff / 3_600_000);
  return hrs > 0 ? `${hrs}h away` : "Soon";
}

type BookingPriceShape = BookingWithDetails & {
  price?: number | string | null;
  unitPrice?: number | string | null;
  pricePerPerson?: number | string | null;
  activityPrice?: number | string | null;
  totalPrice?: number | string | null;
  priceTotal?: number | string | null;
  amountTotal?: number | string | null;
  bookingTotal?: number | string | null;
  currency?: string | null;
};

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function getUnitPrice(b: BookingWithDetails): number | null {
  const priced = b as BookingPriceShape;
  return (
    asNumber(priced.pricePerPerson) ??
    asNumber(priced.unitPrice) ??
    asNumber(priced.activityPrice) ??
    asNumber(priced.price)
  );
}

function getTotalPrice(b: BookingWithDetails): number | null {
  const priced = b as BookingPriceShape;
  const directTotal =
    asNumber(priced.totalPrice) ??
    asNumber(priced.priceTotal) ??
    asNumber(priced.amountTotal) ??
    asNumber(priced.bookingTotal);

  if (directTotal != null) return directTotal;

  const unit = getUnitPrice(b);
  return unit == null ? null : unit * Math.max(1, b.numberOfPeople || 1);
}

function getCurrency(b: BookingWithDetails): string {
  return (b as BookingPriceShape).currency || "TND";
}

function fmtMoney(value: number | null | undefined, currency = "TND"): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: value % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function sortableTime(iso?: string | null): number {
  if (!iso) return Number.MAX_SAFE_INTEGER;
  const t = new Date(iso).getTime();
  return Number.isNaN(t) ? Number.MAX_SAFE_INTEGER : t;
}

function sortBookingsBySession(a: BookingWithDetails, b: BookingWithDetails): number {
  return sortableTime(a.sessionStartAt) - sortableTime(b.sessionStartAt);
}

function makeActivityGroupKey(b: BookingWithDetails, ds = getDisplayStatus(b)): string {
  const title = (b.activityTitle ?? "Activity").trim().toLowerCase();
  const location = [b.latitude, b.longitude].every((v) => v != null)
    ? `${b.latitude}|${b.longitude}`
    : `${b.governorate ?? ""}|${b.locality ?? ""}|${b.displayName ?? ""}`.toLowerCase();

  return `${ds}|${title}|${location}`;
}

// ─── SVG Icons ───────────────────────────────────────────────────────────────
const IcoMap      = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/><line x1="8" y1="2" x2="8" y2="18"/><line x1="16" y1="6" x2="16" y2="22"/></svg>;
const IcoList     = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>;
const IcoArrow    = () => <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>;
const IcoCompass  = () => <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/></svg>;
const IcoPin      = () => <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>;
const IcoCal      = () => <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>;
const IcoUsers    = () => <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></svg>;
const IcoClose    = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>;
const IcoAlert    = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>;
const IcoCreditCard = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>;
const IcoMoney    = () => <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2"/><path d="M6 12h.01M18 12h.01"/></svg>;
const IcoPlus     = () => <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>;
const IcoMinus    = () => <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><line x1="5" y1="12" x2="19" y2="12"/></svg>;
const IcoCheck    = () => <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>;
const IcoExtLink  = () => <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>;
const IcoChevron  = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>;
const IcoStripe   = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 2a10 10 0 100 20 10 10 0 000-20z"/><path d="M8 12h8M12 8v8"/></svg>;

// ─── Cancel Modal ─────────────────────────────────────────────────────────────
function LegacyCancelModal({
  onConfirm, onDismiss, busy,
}: { onConfirm: () => void; onDismiss: () => void; busy: boolean }) {
  const overlayRef = useRef<HTMLDivElement>(null);
  return (
    <div
      className={styles.modalOverlay}
      ref={overlayRef}
      onClick={(e) => { if (e.target === overlayRef.current) onDismiss(); }}
      role="dialog" aria-modal aria-labelledby="cancel-title"
    >
      <div className={styles.modal}>
        <div className={styles.modalIconWrap}><IcoAlert /></div>
        <h3 className={styles.modalTitle} id="cancel-title">Cancel this booking?</h3>
        <p className={styles.modalBody}>
          This action can't be undone. Your spot will be released and you'll receive a confirmation email.
        </p>
        <div className={styles.modalActions}>
          <button className={styles.modalKeep} onClick={onDismiss} type="button">Keep it</button>
          <button
            className={`${styles.modalCancel} ${busy ? styles.btnBusy : ""}`}
            onClick={onConfirm} disabled={busy} type="button"
          >
            {busy ? <><div className={styles.spinner} />Cancelling…</> : "Yes, cancel"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Sidebar Card ─────────────────────────────────────────────────────────────
void LegacyCancelModal;

const SidebarCard = forwardRef<HTMLButtonElement, {
  b: BookingWithDetails;
  selected: boolean;
  hovered: boolean;
  onClick: () => void;
  onHover: () => void;
  onLeave: () => void;
}>(function SidebarCard({ b, selected, hovered, onClick, onHover, onLeave }, ref) {
  const ds        = getDisplayStatus(b);
  const cfg       = getDisplayCfg(ds);
  const countdown = timeCountdown(b.sessionStartAt);
  const isFuture  = ds === "UPCOMING"  || ds === "PENDING_PAYMENT";
  const totalPrice = getTotalPrice(b);
  const unitPrice = getUnitPrice(b);

  return (
    <button
      ref={ref}
      className={[
        styles.sideCard,
        selected ? styles.sideCardSelected : "",
        hovered  ? styles.sideCardHovered  : "",
      ].join(" ")}
      onClick={onClick}
      onMouseEnter={onHover}
      onMouseLeave={onLeave}
      type="button"
    >
      {/* Left accent bar */}
      {selected && (
        <div className={styles.sideCardAccent} style={{ background: cfg.color }} />
      )}

      {/* Thumbnail */}
      <div className={styles.sideCardImage}>
        {b.activityImageUrl
          ? <img src={b.activityImageUrl ?? undefined} alt={b.activityTitle ?? ""} loading="lazy" />
          : <div className={styles.sideCardImageFallback}><IcoCompass /></div>
        }
      </div>

      {/* Body */}
      <div className={styles.sideCardBody}>
        <div className={styles.sideCardTop}>
          <span className={styles.sideCardTitle}>{b.activityTitle ?? "Activity"}</span>
          <span
            className={styles.statusPill}
            style={{ color: cfg.color, background: cfg.bg, borderColor: cfg.border }}
          >
            {cfg.label}
          </span>
        </div>

        <div className={styles.sideCardMetas}>
          {b.sessionStartAt && (
            <span className={styles.sideCardMeta}>
              <IcoCal />
              <span className={styles.metaText}>{fmtDate(b.sessionStartAt)}</span>
              {isFuture && countdown && (
                <span className={styles.countdown}>{countdown}</span>
              )}
            </span>
          )}
          {(b.governorate || b.displayName) && (
            <span className={styles.sideCardMeta}>
              <IcoPin />
              <span className={styles.metaText}>{b.governorate ?? b.displayName}</span>
            </span>
          )}
          <span className={styles.sideCardMeta}>
            <IcoUsers />
            <span className={styles.metaText}>
              {b.numberOfPeople} guest{b.numberOfPeople !== 1 ? "s" : ""}
            </span>
          </span>
          {totalPrice != null && (
            <span className={styles.sideCardMeta}>
              <IcoMoney />
              <span className={styles.metaText}>
                {fmtMoney(totalPrice, getCurrency(b))}
                {unitPrice != null && b.numberOfPeople > 1 ? ` · ${fmtMoney(unitPrice, getCurrency(b))}/guest` : ""}
              </span>
            </span>
          )}
        </div>
      </div>
    </button>
  );
});

void SidebarCard;

type SidebarBookingGroup = {
  id: string;
  title: string;
  displayStatus: DisplayStatus;
  bookings: BookingWithDetails[];
};

function getLocationText(b: BookingWithDetails): string {
  return [b.governorate, b.locality].filter(Boolean).join(", ") || b.displayName || "Location to be announced";
}

function activityDetailsPath(b: BookingWithDetails): string | null {
  return b.activityTemplateId ? `/activities/${b.activityTemplateId}` : null;
}

function ActivityDetailsUnavailable({ className }: { className?: string }) {
  return (
    <button
      type="button"
      className={className}
      disabled
      title="Activity details are not available for this booking."
    >
      View activity <IcoExtLink />
    </button>
  );
}

function formatMoneyMinor(amount?: number | null, currency?: string | null): string {
  if (amount == null || !Number.isFinite(amount)) return "-";
  const code = currency || "TND";
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: code,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount / 100);
  } catch {
    return `${(amount / 100).toFixed(2)} ${code}`;
  }
}

function refundBadgeLabel(status?: RefundStatus | null): string {
  if (status === "NOT_REFUNDABLE") return "Not refundable";
  if (status === "REFUND_PENDING") return "Refund pending";
  if (status === "REFUNDED") return "Refunded";
  if (status === "PARTIALLY_REFUNDED") return "Partially refunded";
  if (status === "REFUND_FAILED") return "Refund failed";
  return "No refund";
}

function refundBadgeTone(status?: RefundStatus | null): string {
  if (status === "REFUNDED") return styles.refundBadgeGreen;
  if (status === "PARTIALLY_REFUNDED") return styles.refundBadgeAmber;
  if (status === "REFUND_PENDING") return styles.refundBadgeBlue;
  if (status === "REFUND_FAILED") return styles.refundBadgeRed;
  return styles.refundBadgeMuted;
}

function resizeGuestNames(names: string[] | undefined, count: number, mainGuestName: string): string[] {
  return Array.from({ length: Math.max(1, count) }, (_, index) => {
    if (index === 0) return names?.[0] ?? mainGuestName;
    return names?.[index] ?? "";
  });
}

function getEditableGuestNames(b: BookingWithDetails, mainGuestName: string): string[] {
  const stored = Array.isArray(b.guestNames) ? b.guestNames : [];
  const names =
    stored.length === b.numberOfPeople
      ? stored
      : [mainGuestName, ...stored];

  return resizeGuestNames(names, b.numberOfPeople, mainGuestName);
}

function getPreviewStatusText(ds: DisplayStatus): string {
  if (ds === "PENDING_PAYMENT") return "Payment needed";
  if (ds === "PAYING") return "Payment in progress";
  return getDisplayCfg(ds).label;
}

function getExpandedStatusText(ds: DisplayStatus): string {
  if (ds === "PENDING_PAYMENT") return "Awaiting payment";
  if (ds === "PAYING") return "Checkout in progress";
  if (ds === "COMPLETED") return "Trip completed";
  if (ds === "CANCELLED") return "Booking cancelled";
  if (ds === "EXPIRED") return "Booking expired";
  return "Trip confirmed";
}

function shortId(id?: string | null): string {
  if (!id) return "N/A";
  return id.length <= 10 ? id : `${id.slice(0, 6)}...${id.slice(-4)}`;
}

function buildGuestPassUrl(token: string): string {
  if (typeof window === "undefined") return `/guide/check-in/${token}`;
  return `${window.location.origin}/guide/check-in/${token}`;
}

function buildFriendPassUrl(token: string): string {
  if (typeof window === "undefined") return `/passes/${token}`;
  return `${window.location.origin}/passes/${token}`;
}

function getAttendanceLabel(pass: GuestPass): string {
  if (pass.status === "CANCELLED") return "CANCELLED";
  if (pass.attendanceStatus === "PRESENT") return "PRESENT";
  if (pass.attendanceStatus === "ABSENT") return "ABSENT";
  return "ACTIVE";
}

function GuestPassCards({
  booking,
  passes,
  loading,
  error,
}: {
  booking: BookingWithDetails;
  passes: GuestPass[] | undefined;
  loading: boolean;
  error: string | undefined;
}) {
  const [message, setMessage] = useState("");

  async function copyPassLink(pass: GuestPass) {
    const passUrl = buildFriendPassUrl(pass.token);
    try {
      await navigator.clipboard.writeText(passUrl);
      setMessage(`Copied pass link for ${pass.guestName || "guest"}.`);
    } catch {
      setMessage("Could not copy link. Open the pass and copy it from the browser.");
    }
  }

  async function sharePass(pass: GuestPass) {
    const passUrl = buildFriendPassUrl(pass.token);
    const guestName = pass.guestName || "your guest";

    try {
      if (navigator.share) {
        await navigator.share({
          title: "UnTamed guest pass",
          text: `Here is your UnTamed guest pass for ${guestName}`,
          url: passUrl,
        });
        setMessage(`Shared pass for ${guestName}.`);
      } else {
        await navigator.clipboard.writeText(passUrl);
        setMessage(`Sharing is not available here, so I copied ${guestName}'s pass link.`);
      }
    } catch {
      setMessage("Share cancelled or unavailable.");
    }
  }

  if (loading) {
    return <div className={styles.passState}>Loading guest passes...</div>;
  }

  if (error) {
    return <div className={`${styles.passState} ${styles.passStateError}`}>{error}</div>;
  }

  if (!passes) return null;

  if (passes.length === 0) {
    return <div className={styles.passState}>No guest passes were created for this booking yet.</div>;
  }

  return (
    <div className={styles.guestPassPanel}>
      <div className={styles.guestPassHeader}>
        <div>
          <span>Guest passes</span>
          <strong>{passes.length} pass{passes.length !== 1 ? "es" : ""}</strong>
        </div>
        <small>Scan at trail check-in</small>
      </div>
      {message && <div className={styles.passToast}>{message}</div>}
      <div className={styles.guestPassGrid}>
        {passes.map((pass) => (
          <article className={styles.guestPassCard} key={pass.id}>
            <div className={styles.guestPassTop}>
              <div>
                <span>Guest Pass {pass.passNumber} / {pass.totalPasses}</span>
                <strong>{pass.guestName || "Guest"}</strong>
                <small>{pass.mainBooker ? "Main booker" : "Guest"} - {booking.activityTitle ?? "Adventure"}</small>
              </div>
              <span className={`${styles.passBadge} ${styles[`passBadge${getAttendanceLabel(pass)}`] ?? ""}`}>
                {getAttendanceLabel(pass).replace("_", " ")}
              </span>
            </div>
            <div className={styles.qrWrap}>
              <QRCodeCanvas
                value={buildGuestPassUrl(pass.token)}
                size={190}
                includeMargin
                level="M"
              />
            </div>
            <div className={styles.passMeta}>
              <span>Booking #{shortId(pass.bookingId)}</span>
              <code>{shortId(pass.token)}</code>
            </div>
            <div className={styles.passActions}>
              <a href={buildFriendPassUrl(pass.token)} target="_blank" rel="noreferrer">Open pass</a>
              <button type="button" onClick={() => void sharePass(pass)}>Share</button>
              <button type="button" onClick={() => void copyPassLink(pass)}>Copy link</button>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

function PreviewBookingCard({
  b,
  selected,
  onSelect,
  onPay,
  onCancel,
  onAdjustGuests,
  onViewPasses,
  guestNames,
  guestNameError,
  onGuestNameChange,
  passes,
  passesLoading,
  passesError,
  onReview,
  guideReviewEligibility,
  guideReviewLoading,
  onGuideReview,
}: {
  b: BookingWithDetails;
  selected: boolean;
  onSelect: (b: BookingWithDetails) => void;
  onPay: (b: BookingWithDetails) => void;
  onCancel: (b: BookingWithDetails) => void;
  onAdjustGuests: (b: BookingWithDetails) => void;
  onViewPasses: (b: BookingWithDetails) => void;
  guestNames: string[];
  guestNameError?: string;
  onGuestNameChange: (bookingId: string, index: number, value: string) => void;
  passes?: GuestPass[];
  passesLoading: boolean;
  passesError?: string;
  onReview: (b: BookingWithDetails) => void;
  guideReviewEligibility?: GuideReviewEligibility;
  guideReviewLoading: boolean;
  onGuideReview: (b: BookingWithDetails) => void;
}) {
  const ds = getDisplayStatus(b);
  const cfg = getDisplayCfg(ds);
  const date = b.sessionStartAt ? new Date(b.sessionStartAt) : null;
  const dateOk = date && !Number.isNaN(date.getTime());
  const month = dateOk ? date.toLocaleDateString("en-US", { month: "short" }).toUpperCase() : "TBD";
  const day = dateOk ? date.toLocaleDateString("en-US", { day: "2-digit" }) : "--";
  const unitPrice = getUnitPrice(b);
  const totalPrice = getTotalPrice(b);
  const canPay = ds === "PENDING_PAYMENT";
  const canCancel = ds === "PENDING_PAYMENT" || ds === "UPCOMING";
  const canAdjust = ds === "PENDING_PAYMENT";
  const showGuestEditor = canPay || ds === "PAYING";
  const canReview = ds === "COMPLETED";
  const canReviewGuide = canReview && Boolean(b.guideId) && Boolean(guideReviewEligibility?.eligible);
  const canViewPasses = b.status === "COMPLETED";
  const coverStyle = b.activityImageUrl ? ({ backgroundImage: `url(${b.activityImageUrl})` } as CSSProperties) : undefined;
  const detailsPath = activityDetailsPath(b);
  const tone =
    ds === "PENDING_PAYMENT" || ds === "PAYING" ? styles.previewCardPayment :
    ds === "CANCELLED" || ds === "EXPIRED" ? styles.previewCardMuted :
    ds === "COMPLETED" ? styles.previewCardCompleted :
    styles.previewCardUpcoming;

  return (
    <article className={styles.previewCardWrap}>
      <button
        className={`${styles.previewCard} ${tone} ${selected ? styles.previewCardSelected : ""}`}
        onClick={() => onSelect(b)}
        type="button"
        aria-expanded={selected}
      >
        <div className={styles.previewCardBg} style={coverStyle} />
        <div className={styles.previewCardOverlay} />
        <span className={styles.previewStatusPill} style={{ "--status-color": cfg.color } as CSSProperties}>
          {getPreviewStatusText(ds)}
        </span>
        <div className={styles.previewDateBadge}>
          <span>{month}</span>
          <strong>{day}</strong>
        </div>
        <div className={styles.previewCardText}>
          <h3 className={styles.previewCardTitle}>{b.activityTitle ?? "Adventure"}</h3>
          <p className={styles.previewCardLocation}>{getLocationText(b)}</p>
        </div>
        <div className={styles.previewSummary}>
          <span>{b.numberOfPeople} guest{b.numberOfPeople !== 1 ? "s" : ""}</span>
          <strong>{totalPrice != null ? fmtMoney(totalPrice, getCurrency(b)) : "TND 0"}</strong>
        </div>
      </button>

      {selected && (
        <div className={styles.expandedPreview}>
          <div className={styles.expandedPreviewContent}>
            <h3 className={styles.expandedPreviewTitle}>{b.activityTitle ?? "Adventure"}</h3>
            <p className={styles.expandedPreviewLocation}><IcoPin /> {getLocationText(b)}</p>
            <div className={styles.expandedPreviewFacts}>
              <div className={styles.expandedPreviewFact}>
                <span>Date</span>
                <strong>{fmtDate(b.sessionStartAt)}</strong>
              </div>
              <div className={styles.expandedPreviewFact}>
                <span>Guests</span>
                <strong>{b.numberOfPeople}</strong>
              </div>
              <div className={styles.expandedPreviewFact}>
                <span>Total</span>
                <strong>{totalPrice != null ? fmtMoney(totalPrice, getCurrency(b)) : "TND 0"}</strong>
              </div>
              <div className={`${styles.expandedPreviewFact} ${styles.expandedPreviewFactWide}`}>
                <span>Price per guest</span>
                <strong>{unitPrice != null ? fmtMoney(unitPrice, getCurrency(b)) : "Price unavailable"}</strong>
              </div>
            </div>
            {showGuestEditor && (
              <section className={styles.guestNamesSection} aria-labelledby={`guest-names-${b.id}`}>
                <div className={styles.guestNamesHeader}>
                  <h4 id={`guest-names-${b.id}`}>Guest names</h4>
                  <p>Names will appear on the trip passes.</p>
                </div>
                <div className={styles.guestNamesGrid}>
                  {guestNames.map((name, index) => (
                    <label className={styles.guestNameField} key={`${b.id}-guest-${index}`}>
                      <span>Guest {index + 1}</span>
                      <input
                        type="text"
                        value={name}
                        onChange={(event) => onGuestNameChange(b.id, index, event.target.value)}
                        placeholder={index === 0 ? "Your name" : "Friend name"}
                        autoComplete="name"
                      />
                    </label>
                  ))}
                </div>
                {guestNameError && <p className={styles.guestNameError}>{guestNameError}</p>}
              </section>
            )}
            {b.status === "CANCELLED" && (
              <div className={styles.refundMeta}>
                <span className={`${styles.refundBadge} ${refundBadgeTone(b.refundStatus)}`}>
                  {refundBadgeLabel(b.refundStatus)}
                </span>
                {(b.refundAmount ?? 0) > 0 && (
                  <span>{formatMoneyMinor(b.refundAmount, b.refundCurrency)} refund</span>
                )}
                {b.cancelledBy && <span>Cancelled by {b.cancelledBy.toLowerCase()}</span>}
                {b.cancelledAt && <span>{fmtDate(b.cancelledAt)}</span>}
              </div>
            )}
          </div>
          <div className={styles.expandedPreviewFooter}>
            <span className={styles.expandedStatusText}>{getExpandedStatusText(ds)}</span>
            <div className={styles.expandedActions}>
              {canAdjust && <button type="button" onClick={() => onAdjustGuests(b)}>Adjust guests</button>}
              {canPay && <button type="button" className={styles.modalPrimary} onClick={() => onPay(b)}>Pay now</button>}
              {canCancel && <button type="button" className={styles.modalDanger} onClick={() => onCancel(b)}>Cancel</button>}
              {detailsPath ? (
                <Link to={detailsPath as string}>View activity <IcoExtLink /></Link>
              ) : (
                <ActivityDetailsUnavailable />
              )}
              {b.guideId && (
                <Link to={`/users/${b.guideId}`}>View guide <IcoExtLink /></Link>
              )}
              {canViewPasses && <button type="button" onClick={() => onViewPasses(b)}>View passes</button>}
              {canReview && b.alreadyReviewed && (
                <button type="button" disabled>Activity reviewed</button>
              )}
              {canReview && !b.alreadyReviewed && b.reviewEligible && (
                <button type="button" onClick={() => onReview(b)}>Review activity</button>
              )}
              {canReview && guideReviewEligibility?.alreadyReviewed && (
                <button type="button" disabled>Guide reviewed</button>
              )}
              {canReview && guideReviewLoading && (
                <button type="button" disabled>Checking guide...</button>
              )}
              {canReviewGuide && (
                <button type="button" onClick={() => onGuideReview(b)}>Review guide</button>
              )}
            </div>
          </div>
          {canViewPasses && (
            <GuestPassCards
              booking={b}
              passes={passes}
              loading={passesLoading}
              error={passesError}
            />
          )}
        </div>
      )}
    </article>
  );
}

function PayNowModal({
  b,
  busy,
  onDismiss,
  onConfirm,
}: {
  b: BookingWithDetails;
  busy: boolean;
  onDismiss: () => void;
  onConfirm: () => void;
}) {
  const unit = getUnitPrice(b);
  const total = getTotalPrice(b);
  return (
    <div className={styles.modalOverlay} role="dialog" aria-modal aria-labelledby="pay-title">
      <div className={styles.bookingModal}>
        <h3 id="pay-title" className={styles.modalTitle}>Pay now</h3>
        <div className={styles.modalSummary}>
          <strong>{b.activityTitle ?? "Adventure"}</strong>
          <span>{fmtDate(b.sessionStartAt)}</span>
          <span>{b.numberOfPeople} guest{b.numberOfPeople !== 1 ? "s" : ""}</span>
        </div>
        <div className={styles.modalPriceRows}>
          <span>Per guest</span><strong>{unit != null ? fmtMoney(unit, getCurrency(b)) : "Price unavailable"}</strong>
          <span>Guests</span><strong>x {b.numberOfPeople}</strong>
          <div className={styles.modalDivider} />
          <span>Total due</span><strong className={styles.modalTotal}>{total != null ? fmtMoney(total, getCurrency(b)) : "TND 0"}</strong>
        </div>
        <div className={styles.modalActions}>
          <button className={styles.modalSecondary} onClick={onDismiss} disabled={busy} type="button">Cancel</button>
          <button className={styles.modalPrimary} onClick={onConfirm} disabled={busy} type="button">
            {busy ? "Starting..." : `Pay ${total != null ? fmtMoney(total, getCurrency(b)) : "TND 0"}`}
          </button>
        </div>
        <p className={styles.modalSecure}>Lock - Secured by Stripe</p>
      </div>
    </div>
  );
}

function CancelBookingModal({
  b,
  preview,
  previewLoading,
  previewError,
  busy,
  onDismiss,
  onConfirm,
}: {
  b: BookingWithDetails;
  preview?: RefundPreviewResponse | null;
  previewLoading: boolean;
  previewError?: string;
  busy: boolean;
  onDismiss: () => void;
  onConfirm: () => void;
}) {
  const refundAmount = preview ? formatMoneyMinor(preview.refundAmount, preview.currency) : "-";
  return (
    <div className={styles.modalOverlay} role="dialog" aria-modal aria-labelledby="cancel-booking-title">
      <div className={styles.bookingModal}>
        <div className={styles.modalDangerIcon}><IcoAlert /></div>
        <h3 id="cancel-booking-title" className={styles.modalTitle}>Cancel this booking?</h3>
        <p className={styles.modalBody}>{b.activityTitle ?? "This booking"} - {fmtDate(b.sessionStartAt)}</p>
        {previewLoading && <div className={styles.warningBox}>Checking refund eligibility...</div>}
        {previewError && <div className={styles.warningBox}>{previewError}</div>}
        {preview && (
          <div className={styles.refundPreviewBox}>
            <div>
              <span>Refund</span>
              <strong>{preview.refundPercent}%</strong>
            </div>
            <div>
              <span>Amount</span>
              <strong>{refundAmount}</strong>
            </div>
            <span className={`${styles.refundBadge} ${refundBadgeTone(preview.refundStatus)}`}>
              {refundBadgeLabel(preview.refundStatus)}
            </span>
            <p>{preview.reason}</p>
            <p className={preview.refundPercent > 0 ? styles.refundPositive : styles.refundWarning}>
              {preview.refundPercent > 0
                ? `You will receive a refund of ${refundAmount}.`
                : "This booking is not refundable."}
            </p>
          </div>
        )}
        <div className={styles.modalActions}>
          <button className={styles.modalSecondary} onClick={onDismiss} disabled={busy} type="button">Keep it</button>
          <button className={styles.modalDanger} onClick={onConfirm} disabled={busy || previewLoading || !preview} type="button">
            {busy ? "Cancelling..." : "Yes, cancel"}
          </button>
        </div>
      </div>
    </div>
  );
}

function AdjustGuestsModal({
  b,
  busy,
  onDismiss,
  onConfirm,
}: {
  b: BookingWithDetails;
  busy: boolean;
  onDismiss: () => void;
  onConfirm: (nextCount: number) => void;
}) {
  const [count, setCount] = useState(b.numberOfPeople);
  const unit = getUnitPrice(b);
  const nextTotal = unit == null ? null : unit * count;
  const unchanged = count === b.numberOfPeople;

  return (
    <div className={styles.modalOverlay} role="dialog" aria-modal aria-labelledby="guests-title">
      <div className={styles.bookingModal}>
        <div className={styles.modalUsersIcon}><IcoUsers /></div>
        <h3 id="guests-title" className={styles.modalTitle}>Adjust guests</h3>
        <div className={styles.guestStepper}>
          <div>
            <strong>Guests</strong>
            <span>{unit != null ? `${fmtMoney(unit, getCurrency(b))} per person` : "Price unavailable"}</span>
          </div>
          <button className={styles.stepperButton} onClick={() => setCount((v) => Math.max(1, v - 1))} disabled={count <= 1 || busy} type="button"><IcoMinus /></button>
          <strong>{count}</strong>
          <button className={styles.stepperButton} onClick={() => setCount((v) => v + 1)} disabled={busy} type="button"><IcoPlus /></button>
        </div>
        <div className={styles.modalPriceRows}>
          <span>{unit != null ? `${fmtMoney(unit, getCurrency(b))} x ${count} guest${count !== 1 ? "s" : ""}` : "Price unavailable"}</span>
          <strong>{nextTotal != null ? fmtMoney(nextTotal, getCurrency(b)) : "TND 0"}</strong>
          <div className={styles.modalDivider} />
          <span>New total</span>
          <strong className={styles.modalTotal}>{nextTotal != null ? fmtMoney(nextTotal, getCurrency(b)) : "TND 0"}</strong>
        </div>
        <div className={styles.modalActions}>
          <button className={styles.modalSecondary} onClick={onDismiss} disabled={busy} type="button">Cancel</button>
          <button className={styles.modalPrimary} onClick={() => onConfirm(count)} disabled={busy || unchanged} type="button">Confirm</button>
        </div>
      </div>
    </div>
  );
}

// ─── Grouped Sidebar Card ─────────────────────────────────────────────────────
function ReviewBookingModal({
  booking,
  onDismiss,
  onSubmit,
}: {
  booking: BookingWithDetails;
  onDismiss: () => void;
  onSubmit: (data: { rating: number; comment: string }) => Promise<void>;
}) {
  return (
    <div className={styles.modalOverlay} role="dialog" aria-modal aria-labelledby="review-booking-title">
      <div className={`${styles.bookingModal} ${styles.reviewModal}`}>
        <h3 id="review-booking-title" className={styles.modalTitle}>Review this trip</h3>
        <p className={styles.modalBody}>
          {booking.activityTitle ?? "This activity"} - {fmtDate(booking.sessionStartAt)}
        </p>
        <ReviewForm
          submitLabel="Post review"
          onCancel={onDismiss}
          onSubmit={onSubmit}
        />
      </div>
    </div>
  );
}

function GuideReviewModal({
  booking,
  busy,
  onDismiss,
  onSubmit,
}: {
  booking: BookingWithDetails;
  busy: boolean;
  onDismiss: () => void;
  onSubmit: (data: { rating: number; comment: string }) => Promise<void>;
}) {
  return (
    <div className={styles.modalOverlay} role="dialog" aria-modal aria-labelledby="guide-review-title">
      <div className={`${styles.bookingModal} ${styles.reviewModal}`}>
        <h3 id="guide-review-title" className={styles.modalTitle}>Review guide</h3>
        <p className={styles.modalBody}>
          This review is about the guide for {booking.activityTitle ?? "this trip"}, not the activity itself.
        </p>
        {busy && <div className={styles.guideReviewNotice}>Posting your guide review...</div>}
        <ReviewForm
          submitLabel={busy ? "Posting..." : "Post guide review"}
          onCancel={onDismiss}
          onSubmit={onSubmit}
        />
      </div>
    </div>
  );
}

const GroupedSidebarCard = forwardRef<HTMLButtonElement, {
  group: SidebarBookingGroup;
  selectedId: string | null;
  hoveredId: string | null;
  setRefForBookings: (bookings: BookingWithDetails[], el: HTMLButtonElement | null) => void;
  onSelect: (b: BookingWithDetails) => void;
  onHover: (id: string | null) => void;
  onPay: (id: string) => void;
  onCancel: (id: string) => void;
  onInc: (id: string) => void;
  onDec: (id: string, current: number) => void;
  busyId: string | null;
  isListMode: boolean;
  isFeatured: boolean;
}>(function GroupedSidebarCard(
  { group, selectedId, hoveredId, setRefForBookings, onSelect, onHover, onPay, onCancel, onInc, onDec, busyId, isListMode, isFeatured },
  ref
) {
  const sortedBookings = [...group.bookings].sort(sortBookingsBySession);
  const main = sortedBookings[0];
  const selectedBooking = group.bookings.find((b) => b.id === selectedId) ?? null;
  const displayBooking = selectedBooking ?? main;
  const ds = group.displayStatus;
  const cfg = getDisplayCfg(ds);
  const selected = group.bookings.some((b) => b.id === selectedId);
  const hovered = group.bookings.some((b) => b.id === hoveredId);
  const countdown = timeCountdown(main.sessionStartAt);
  const isFuture = ds === "UPCOMING" || ds === "PENDING_PAYMENT";
  const totalGuests = group.bookings.reduce((sum, b) => sum + (b.numberOfPeople || 0), 0);
  const totalGroupPrice = group.bookings.reduce((sum, b) => sum + (getTotalPrice(b) ?? 0), 0);
  const hasAnyPrice = group.bookings.some((b) => getTotalPrice(b) != null);
  const hasMultipleSessions = group.bookings.length > 1;
  const date = displayBooking.sessionStartAt ? new Date(displayBooking.sessionStartAt) : null;
  const dateDay = date && !Number.isNaN(date.getTime()) ? date.toLocaleDateString("en-US", { day: "2-digit" }) : "--";
  const dateMonth = date && !Number.isNaN(date.getTime()) ? date.toLocaleDateString("en-US", { month: "short" }).toUpperCase() : "TBD";
  const dateTime = date && !Number.isNaN(date.getTime()) ? date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }) : "";
  const totalPrice = getTotalPrice(displayBooking);
  const detailsPath = activityDetailsPath(displayBooking);
  const isCompleted = ds === "COMPLETED";
  const locationText = [displayBooking.governorate, displayBooking.locality].filter(Boolean).join(", ") || displayBooking.displayName;
  const isPendingPayment = ds === "PENDING_PAYMENT";
  const isPaying = ds === "PAYING";
  const isMutedStatus = ds === "CANCELLED" || ds === "EXPIRED";
  const statusLabel =
    ds === "UPCOMING" ? "UPCOMING" :
    ds === "COMPLETED" ? "CONFIRMED" :
    ds === "PENDING_PAYMENT" ? "PAYMENT NEEDED" :
    ds === "PAYING" ? "PAYING" :
    ds;
  const statusClass =
    ds === "COMPLETED" ? styles.statusPillCompleted :
    ds === "PENDING_PAYMENT" || ds === "PAYING" ? styles.statusPillPayment :
    isMutedStatus ? styles.statusPillMuted :
    styles.statusPillUpcoming;
  const heroMessage =
    isPendingPayment ? "Payment needed to hold your spot" :
    isPaying ? "Checkout in progress" :
    ds === "COMPLETED" ? "Adventure completed" :
    isMutedStatus ? `Booking ${ds.toLowerCase()}` :
    "Trip confirmed";
  const coverStyle = displayBooking.activityImageUrl
    ? ({ backgroundImage: `url(${displayBooking.activityImageUrl})` } as CSSProperties)
    : undefined;

  if (isListMode) {
    return (
      <article
        className={[
          styles.heroBookingCard,
          isFeatured ? styles.heroBookingFeatured : styles.heroBookingSecondary,
          isCompleted || isMutedStatus ? styles.heroBookingCompleted : "",
          isPendingPayment || isPaying ? styles.heroBookingAttention : "",
        ].join(" ")}
        style={coverStyle}
      >
        <div className={styles.heroOverlay}>
          <div className={styles.heroTop}>
            <span className={`${styles.statusPill} ${statusClass}`}>
              {statusLabel}
            </span>
            {totalPrice != null && (
              <span className={styles.heroPrice}>{fmtMoney(totalPrice, getCurrency(displayBooking))}</span>
            )}
            <span className={styles.heroDateChip}>{dateMonth} {dateDay}</span>
          </div>

          <div className={styles.heroBottom}>
            <div className={styles.heroText}>
              <h3 className={styles.heroTitle}>{group.title}</h3>
              <span className={styles.heroLocation}>{locationText || "Location to be announced"}</span>
              {isFeatured && (
                <div className={styles.heroMetaLine}>
                  {dateTime && <span>{dateTime}</span>}
                  <span>{displayBooking.numberOfPeople} guest{displayBooking.numberOfPeople !== 1 ? "s" : ""}</span>
                  <span className={styles.heroConfirm}><IcoCheck /> {heroMessage}</span>
                </div>
              )}
            </div>

            {isFeatured && (
              <div className={styles.heroActions}>
                {isPendingPayment && (
                  <>
                    <button
                      className={styles.heroPayBtn}
                      onClick={() => onPay(displayBooking.id)}
                      disabled={busyId === displayBooking.id}
                      type="button"
                    >
                      {busyId === displayBooking.id ? "Processing..." : "Pay now"}
                    </button>
                    <button
                      className={styles.heroCancelBtn}
                      onClick={() => onCancel(displayBooking.id)}
                      disabled={busyId === displayBooking.id}
                      type="button"
                    >
                      Cancel
                    </button>
                  </>
                )}
                {detailsPath ? (
                  <Link to={detailsPath as string} className={styles.heroViewBtn}>
                    View activity <IcoExtLink />
                  </Link>
                ) : (
                  <ActivityDetailsUnavailable className={styles.heroViewBtn} />
                )}
              </div>
            )}

            {!isFeatured && (
              <div className={styles.heroSecondaryMeta}>
                <span>{displayBooking.numberOfPeople} guest{displayBooking.numberOfPeople !== 1 ? "s" : ""}</span>
                {totalPrice != null && <span>{fmtMoney(totalPrice, getCurrency(displayBooking))}</span>}
                {isPendingPayment && (
                  <button
                    className={styles.heroMiniAction}
                    onClick={() => onPay(displayBooking.id)}
                    disabled={busyId === displayBooking.id}
                    type="button"
                  >
                    Pay
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </article>
    );
  }

  return (
    <div className={styles.passportWrap}>
      <button
        ref={(el) => {
          if (typeof ref === "function") ref(el);
          else if (ref) ref.current = el;
          setRefForBookings(group.bookings, el);
        }}
        className={[
          styles.sideCard,
          selected ? styles.sideCardSelected : "",
          hovered ? styles.sideCardHovered : "",
        ].join(" ")}
        onClick={() => onSelect(displayBooking)}
        onMouseEnter={() => onHover(displayBooking.id)}
        onMouseLeave={() => onHover(null)}
        type="button"
        aria-expanded={selected}
      >
        <div className={`${styles.passportDate} ${isCompleted ? styles.passportDateCompleted : styles.passportDateUpcoming}`}>
          <span className={styles.passportDay}>{dateDay}</span>
          <span className={styles.passportMonth}>{dateMonth}</span>
          <span className={styles.passportTime}>{dateTime}</span>
        </div>

        <div className={styles.passportMain}>
          <div className={styles.passportTop}>
            <span className={styles.sideCardTitle}>{group.title}</span>
            {totalPrice != null && (
              <span className={styles.passportPrice}>{fmtMoney(totalPrice, getCurrency(displayBooking))}</span>
            )}
          </div>

          <div className={styles.passportLocation}>
            {locationText || "Location to be announced"}
          </div>

          <div className={styles.passportBottom}>
            <span className={styles.passportGuests}>
              {displayBooking.numberOfPeople} guest{displayBooking.numberOfPeople !== 1 ? "s" : ""}
              {hasMultipleSessions ? ` · ${group.bookings.length} sessions` : ""}
            </span>
            <span className={`${styles.statusPill} ${isCompleted ? styles.statusPillCompleted : styles.statusPillUpcoming}`}>
              {isCompleted ? "Completed" : "Upcoming"}
            </span>
          </div>
        </div>
      </button>

      {selectedBooking && (
        <DetailDrawer
          b={selectedBooking}
          onClose={() => undefined}
          onPay={onPay}
          onCancel={onCancel}
          onInc={onInc}
          onDec={onDec}
          busyId={busyId}
        />
      )}
    </div>
  );

  return (
    <button
      ref={(el) => {
        if (typeof ref === "function") ref(el);
        else if (ref) ref.current = el;
        setRefForBookings(group.bookings, el);
      }}
      className={[
        styles.sideCard,
        selected ? styles.sideCardSelected : "",
        hovered  ? styles.sideCardHovered  : "",
      ].join(" ")}
      onClick={() => onSelect(main)}
      onMouseEnter={() => onHover(main.id)}
      onMouseLeave={() => onHover(null)}
      type="button"
    >
      {selected && (
        <div className={styles.sideCardAccent} style={{ background: cfg.color }} />
      )}

      <div className={styles.sideCardImage}>
        {main.activityImageUrl
          ? <img src={main.activityImageUrl ?? undefined} alt={main.activityTitle ?? ""} loading="lazy" />
          : <div className={styles.sideCardImageFallback}><IcoCompass /></div>
        }
      </div>

      <div className={styles.sideCardBody}>
        <div className={styles.sideCardTop}>
          <span className={styles.sideCardTitle}>{group.title}</span>
          <span
            className={styles.statusPill}
            style={{ color: cfg.color, background: cfg.bg, borderColor: cfg.border }}
          >
            {cfg.label}
          </span>
        </div>

        <div className={styles.sideCardMetas}>
          {main.sessionStartAt && (
            <span className={styles.sideCardMeta}>
              <IcoCal />
              <span className={styles.metaText}>
                {hasMultipleSessions
                  ? `Next: ${fmtDate(main.sessionStartAt)}`
                  : fmtDate(main.sessionStartAt)
                }
              </span>
              {isFuture && countdown && (
                <span className={styles.countdown}>{countdown}</span>
              )}
            </span>
          )}

          {(main.governorate || main.displayName) && (
            <span className={styles.sideCardMeta}>
              <IcoPin />
              <span className={styles.metaText}>{main.governorate ?? main.displayName}</span>
            </span>
          )}

          <span className={styles.sideCardMeta}>
            <IcoUsers />
            <span className={styles.metaText}>
              {hasMultipleSessions
                ? `${group.bookings.length} sessions · ${totalGuests} guest${totalGuests !== 1 ? "s" : ""}`
                : `${main.numberOfPeople} guest${main.numberOfPeople !== 1 ? "s" : ""}`
              }
            </span>
          </span>

          {hasAnyPrice && (
            <span className={styles.sideCardMeta}>
              <IcoMoney />
              <span className={styles.metaText}>
                {hasMultipleSessions
                  ? `${fmtMoney(totalGroupPrice, getCurrency(main))} total`
                  : fmtMoney(getTotalPrice(main), getCurrency(main))}
              </span>
            </span>
          )}

          {hasMultipleSessions && (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 4,
                marginTop: 3,
                paddingTop: 5,
                borderTop: "1px solid rgba(0,0,0,0.06)",
              }}
            >
              {sortedBookings.map((b) => {
                const childSelected = b.id === selectedId;
                const childCountdown = timeCountdown(b.sessionStartAt);

                return (
                  <span
                    key={b.id}
                    role="button"
                    tabIndex={0}
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelect(b);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        e.stopPropagation();
                        onSelect(b);
                      }
                    }}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 6,
                      padding: "4px 6px",
                      borderRadius: 8,
                      background: childSelected ? cfg.bg : "rgba(0,0,0,0.025)",
                      border: childSelected ? `1px solid ${cfg.border}` : "1px solid transparent",
                      color: childSelected ? cfg.color : "inherit",
                      cursor: "pointer",
                    }}
                  >
                    <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {fmtDate(b.sessionStartAt)}
                      {getTotalPrice(b) != null ? ` · ${fmtMoney(getTotalPrice(b), getCurrency(b))}` : ""}
                    </span>
                    {childCountdown && (
                      <span className={styles.countdown} style={{ marginLeft: 0 }}>
                        {childCountdown}
                      </span>
                    )}
                  </span>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </button>
  );
});

// ─── Detail Drawer ────────────────────────────────────────────────────────────
function DetailDrawer({
  b, onClose, onPay, onCancel, onInc, onDec, busyId,
}: {
  b: BookingWithDetails;
  onClose: () => void;
  onPay: (id: string) => void;
  onCancel: (id: string) => void;
  onInc: (id: string) => void;
  onDec: (id: string, current: number) => void;
  busyId: string | null;
}) {
  const ds          = getDisplayStatus(b);
  const cfg         = getDisplayCfg(ds);
  const isPending   = b.status === "PENDING";
  const isPaying    = b.status === "PAYING";
  const isCompleted = b.status === "COMPLETED";
  const isMuted     = b.status === "CANCELLED" || b.status === "EXPIRED";
  const isUpcoming  = ds === "UPCOMING" ;
  const busy        = busyId === b.id;
  const unitPrice   = getUnitPrice(b);
  const totalPrice  = getTotalPrice(b);
  const detailsPath = activityDetailsPath(b);
  const locationText = [b.governorate, b.locality].filter(Boolean).join(", ") || b.displayName;

  const statusText = isCompleted && !isUpcoming
    ? "Adventure completed"
    : isMuted
    ? `Booking ${b.status.toLowerCase()}`
    : isPaying
    ? "Checkout in progress"
    : "Trip confirmed";

  const statusClass = isMuted
    ? styles.expandedStatusMuted
    : isPaying
    ? styles.expandedStatusAmber
    : styles.expandedStatus;

  return (
    <div className={styles.inlineDetail}>

      {/* ── Hero image — full width at top ── */}
      <div className={styles.expandedHero}>
        {b.activityImageUrl
          ? <img className={styles.expandedHeroImg} src={b.activityImageUrl ?? undefined} alt="" loading="lazy" />
          : <div className={styles.expandedHeroFallback}><IcoCompass /></div>
        }
      </div>

      {/* ── Content below image ── */}
      <div className={styles.expandedContent}>

        <div>
          <h3 className={styles.expandedTitle}>{b.activityTitle ?? "Adventure"}</h3>
          {locationText && (
            <div className={styles.expandedLocation}>
              <IcoPin />
              {locationText}
            </div>
          )}
        </div>

        {/* Facts grid: Date + Guests, then Total full-width */}
        <div className={styles.expandedFacts}>
          <div className={styles.expandedFact}>
            <span className={styles.expandedFactLabel}>Date</span>
            <span className={styles.expandedFactValue}>{fmtDate(b.sessionStartAt)}</span>
          </div>

          <div className={styles.expandedFact}>
            <span className={styles.expandedFactLabel}>Guests</span>
            <span className={styles.expandedFactValue}>{b.numberOfPeople}</span>
          </div>

          <div className={`${styles.expandedFact} ${styles.expandedFactWide}`}>
            <span className={styles.expandedFactLabel}>Total</span>
            <span className={styles.expandedFactValue}>
              {totalPrice != null ? fmtMoney(totalPrice, getCurrency(b)) : "—"}
            </span>
            {unitPrice != null && b.numberOfPeople > 1 && (
              <span className={styles.expandedFactSub}>
                {fmtMoney(unitPrice, getCurrency(b))} per guest
              </span>
            )}
          </div>
        </div>

        {/* Guest adjuster (pending only) */}
        {isPending && (
          <div className={styles.expandedGuestRow}>
            <span className={styles.guestLabel}>Adjust guests</span>
            <div className={styles.guestControls}>
              <button
                className={styles.guestBtn}
                onClick={() => onDec(b.id, b.numberOfPeople)}
                disabled={b.numberOfPeople <= 1 || busy}
                type="button" aria-label="Decrease"
              >
                <IcoMinus />
              </button>
              <span className={styles.guestCount}>{b.numberOfPeople}</span>
              <button
                className={styles.guestBtn}
                onClick={() => onInc(b.id)}
                disabled={busy}
                type="button" aria-label="Increase"
              >
                <IcoPlus />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Footer ── */}
      <div className={styles.expandedFooter}>
        <span className={statusClass}>
          <IcoCheck />
          {statusText}
        </span>

        <div className={styles.inlineFooterActions}>
          {isPending && (
            <>
              <button
                className={`${styles.actionPay} ${busy ? styles.btnBusy : ""}`}
                onClick={() => onPay(b.id)} disabled={busy} type="button"
              >
                {busy ? <><div className={styles.spinner} />Processing...</> : <><IcoCreditCard /> Pay now</>}
              </button>
              <button
                className={styles.actionCancel}
                onClick={() => onCancel(b.id)}
                disabled={busy} type="button"
              >
                Cancel
              </button>
            </>
          )}
          {detailsPath ? (
            <Link to={detailsPath as string} className={styles.expandedAction}>
              View activity <IcoExtLink />
            </Link>
          ) : (
            <ActivityDetailsUnavailable className={styles.expandedAction} />
          )}
        </div>
      </div>

    </div>
  );

  return (
    <div className={styles.drawer}>
      <div className={styles.drawerPanel}>
        <button
          className={styles.drawerClose}
          onClick={onClose} type="button" aria-label="Close"
        >
          <IcoClose />
        </button>

        <div className={styles.drawerHeader}>
          <div className={styles.drawerThumb}>
            {b.activityImageUrl
              ? <img src={b.activityImageUrl ?? undefined} alt="" className={styles.drawerThumbImg} />
              : <div className={styles.drawerThumbPlaceholder}><IcoCompass /></div>
            }
          </div>

          <div className={styles.drawerHeading}>
            <span
              className={styles.statusPill}
              style={{ color: cfg.color, background: cfg.bg, borderColor: cfg.border }}
            >
              {cfg.label}
            </span>
            <h2 className={styles.drawerTitle}>{b.activityTitle ?? "Adventure"}</h2>
            {locationText && (
              <div className={styles.drawerLocation}>
                <IcoPin />
                {locationText}
              </div>
            )}
          </div>
        </div>

        <div className={styles.drawerBody}>
        <div className={styles.drawerInfoGrid}>
          <div className={styles.drawerInfoItem}>
            <span className={styles.drawerInfoLabel}><IcoCal /> Date</span>
            <span className={styles.drawerInfoValue}>{fmtDate(b.sessionStartAt)}</span>
          </div>
          <div className={styles.drawerInfoItem}>
            <span className={styles.drawerInfoLabel}><IcoUsers /> Guests</span>
            <span className={styles.drawerInfoValue}>{b.numberOfPeople}</span>
          </div>
          <div className={styles.drawerInfoItem}>
            <span className={styles.drawerInfoLabel}><IcoMoney /> Total</span>
            <span className={styles.drawerInfoValue}>
              {totalPrice != null ? fmtMoney(totalPrice, getCurrency(b)) : "Not available"}
            </span>
            {unitPrice != null && b.numberOfPeople > 1 && (
              <span className={styles.drawerInfoSubValue}>
                {fmtMoney(unitPrice, getCurrency(b))} per guest
              </span>
            )}
          </div>
        </div>

        {/* Guest adjuster */}
        {isPending && (
          <div className={styles.guestRow}>
            <span className={styles.guestLabel}>Adjust guests</span>
            <div className={styles.guestControls}>
              <button
                className={styles.guestBtn}
                onClick={() => onDec(b.id, b.numberOfPeople)}
                disabled={b.numberOfPeople <= 1 || busy}
                type="button" aria-label="Decrease"
              >
                <IcoMinus />
              </button>
              <span className={styles.guestCount}>{b.numberOfPeople}</span>
              <button
                className={styles.guestBtn}
                onClick={() => onInc(b.id)}
                disabled={busy}
                type="button" aria-label="Increase"
              >
                <IcoPlus />
              </button>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className={styles.drawerActions}>
          {isPending && (
            <>
              <button
                className={`${styles.actionPay} ${busy ? styles.btnBusy : ""}`}
                onClick={() => onPay(b.id)} disabled={busy} type="button"
              >
                {busy
                  ? <><div className={styles.spinner} />Processing…</>
                  : <><IcoCreditCard /> Pay now</>
                }
              </button>
              <button
                className={styles.actionCancel}
                onClick={() => onCancel(b.id)}
                disabled={busy} type="button"
              >
                Cancel booking
              </button>
            </>
          )}

          {isPaying && (
            <div className={styles.payingBanner}>
              <div className={styles.payingDots}><span /><span /><span /></div>
              <div>
                <div className={styles.payingBannerTitle}>Checkout in progress</div>
                <div className={styles.payingBannerSub}>
                  Return to Stripe or wait for confirmation. Check your email shortly.
                </div>
              </div>
            </div>
          )}

          {isUpcoming && (
            <div className={styles.confirmedBanner}>
              <IcoCheck /> Trip confirmed — you're all set!
            </div>
          )}

          {isCompleted && !isUpcoming && (
            <div className={styles.completedBanner}><IcoCheck /> Adventure completed!</div>
          )}

          {isMuted && (
            <div className={styles.mutedBanner}>
              This booking is {b.status.toLowerCase()}.
            </div>
          )}
        </div>

        {/* Activity link */}
        {detailsPath ? (
          <Link to={detailsPath as string} className={styles.viewActivityLink}>
            View activity <IcoExtLink />
          </Link>
        ) : (
          <ActivityDetailsUnavailable className={styles.viewActivityLink} />
        )}
        </div>
      </div>
    </div>
  );
}

// ─── Paying in-progress notice (sidebar top) ──────────────────────────────────
function PayingNotice({ count }: { count: number }) {
  if (count === 0) return null;
  return (
    <div className={styles.payingNotice}>
      <div className={styles.payingNoticeDots}><span /><span /><span /></div>
      <div>
        <span className={styles.payingNoticeTitle}>
          {count} checkout{count > 1 ? "s" : ""} in progress
        </span>
        <span className={styles.payingNoticeBody}>
          Checkout in progress. Return to Stripe or wait for confirmation.
        </span>
      </div>
      <IcoStripe />
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
function PageToast({
  tone,
  message,
  onClose,
}: {
  tone: ToastTone;
  message: string;
  onClose: () => void;
}) {
  return (
    <div className={`${styles.pageToast} ${styles[`pageToast${tone}`]}`} role="status" aria-live="polite">
      <span>{message}</span>
      <button type="button" onClick={onClose} aria-label="Dismiss notification">
        <IcoClose />
      </button>
    </div>
  );
}

export default function MyBookingsPage() {
  const { user } = useAuth();
  const [bookings,     setBookings]     = useState<BookingWithDetails[]>([]);
  const [state,        setState]        = useState<LoadState>("loading");
  const [err,          setErr]          = useState<string>("");
  const [viewMode,     setViewMode]     = useState<ViewMode>("map");
  const [selectedId,   setSelectedId]   = useState<string | null>(null);
  const [busyId,       setBusyId]       = useState<string | null>(null);
  const [cancelTarget, setCancelTarget] = useState<string | null>(null);
  const [cancelPreview, setCancelPreview] = useState<RefundPreviewResponse | null>(null);
  const [cancelPreviewLoading, setCancelPreviewLoading] = useState(false);
  const [cancelPreviewError, setCancelPreviewError] = useState("");
  const [payTarget,    setPayTarget]    = useState<BookingWithDetails | null>(null);
  const [adjustTarget, setAdjustTarget] = useState<BookingWithDetails | null>(null);
  const [flyTarget,    setFlyTarget]    = useState<{ lat: number; lng: number } | null>(null);
  const [hoveredId,    setHoveredId]    = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<FilterKey>("ALL");
  const [collapsed,    setCollapsed]    = useState<Set<string>>(new Set());
  const [passesByBooking, setPassesByBooking] = useState<Record<string, GuestPass[]>>({});
  const [passLoadingId, setPassLoadingId] = useState<string | null>(null);
  const [passErrors, setPassErrors] = useState<Record<string, string>>({});
  const [guestNamesByBooking, setGuestNamesByBooking] = useState<Record<string, string[]>>({});
  const [guestNameErrors, setGuestNameErrors] = useState<Record<string, string>>({});
  const [reviewTarget, setReviewTarget] = useState<BookingWithDetails | null>(null);
  const [guideReviewTarget, setGuideReviewTarget] = useState<BookingWithDetails | null>(null);
  const [guideReviewEligibilityByBooking, setGuideReviewEligibilityByBooking] = useState<Record<string, GuideReviewEligibility>>({});
  const [guideReviewEligibilityLoading, setGuideReviewEligibilityLoading] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState<{ tone: ToastTone; message: string } | null>(null);

  const cardRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
  const mainGuestName = user?.username?.trim() || user?.email || "";
  const isAdventurer = user?.role === "ADVENTURER" || user?.role === "USER";

  // ── Derived ──────────────────────────────────────────────────────────────
  const totalCount     = bookings.length;
  const upcomingCount  = bookings.filter((b) => getDisplayStatus(b) === "UPCOMING").length;
  const confirmedCount = bookings.filter((b) => b.status === "COMPLETED").length;
  const completedCount = bookings.filter((b) => getDisplayStatus(b) === "COMPLETED").length;
  const historyCount   = bookings.filter((b) => b.status === "EXPIRED" || b.status === "CANCELLED").length;
  const payingCount    = bookings.filter((b) => b.status === "PAYING").length;

  const displayBookings =
    activeFilter === "UPCOMING"
      ? bookings.filter((b) => getDisplayStatus(b) === "UPCOMING")
      : activeFilter === "CONFIRMED"
      ? bookings.filter((b) => b.status === "COMPLETED")
      : activeFilter === "HISTORY"
      ? bookings.filter((b) => b.status === "EXPIRED" || b.status === "CANCELLED")
      : bookings;

  const sidebarGroupsBySection = SECTION_GROUPS.reduce<Record<string, SidebarBookingGroup[]>>((acc, section) => {
    const matchingBookings = displayBookings.filter((b) =>
      (section.displayStatuses as string[]).includes(getDisplayStatus(b))
    );

    const grouped = matchingBookings.reduce<Map<string, SidebarBookingGroup>>((map, b) => {
      const ds = getDisplayStatus(b);
      const key = makeActivityGroupKey(b, ds);
      const existing = map.get(key);

      if (existing) {
        existing.bookings.push(b);
      } else {
        map.set(key, {
          id: key,
          title: b.activityTitle ?? "Activity",
          displayStatus: ds,
          bookings: [b],
        });
      }

      return map;
    }, new Map<string, SidebarBookingGroup>());

    const groupedValues: SidebarBookingGroup[] = Array.from(grouped.values());

    acc[section.id] = groupedValues
      .map((group: SidebarBookingGroup) => ({
        ...group,
        bookings: [...group.bookings].sort(sortBookingsBySession),
      }))
      .sort((a, b) => sortBookingsBySession(a.bookings[0], b.bookings[0]));

    return acc;
  }, {});

  const listBookingsBySection = SECTION_GROUPS.reduce<Record<string, BookingWithDetails[]>>((acc, section) => {
    acc[section.id] = displayBookings
      .filter((b) => {
        const ds = getDisplayStatus(b);
        if (section.id === "pending") return ds === "PENDING_PAYMENT" || ds === "PAYING";
        return (section.displayStatuses as string[]).includes(ds);
      })
      .sort(sortBookingsBySession);
    return acc;
  }, {});

  const cancelBooking = cancelTarget ? bookings.find((b) => b.id === cancelTarget) ?? null : null;

  type MapBookingGroup = {
    id: string;
    lat: number;
    lng: number;
    title: string;
    displayStatus: DisplayStatus;
    bookings: BookingWithDetails[];
  };

  const mapGroups: MapBookingGroup[] = Array.from(
    bookings
      .filter((b) => {
        if (b.latitude == null || b.longitude == null) return false;

        const ds = getDisplayStatus(b);
        const isHistory = ds === "CANCELLED" || ds === "EXPIRED";
        const isFocused = b.id === hoveredId || b.id === selectedId;

        if (activeFilter === "UPCOMING") return ds === "UPCOMING";
        if (activeFilter === "CONFIRMED") return b.status === "COMPLETED";
        if (activeFilter === "HISTORY") return isHistory;

        // In the default map view we keep the map clean by showing only
        // upcoming/completed trips, but temporarily reveal history pins when
        // the user hovers/selects a cancelled or expired booking in the list.
        return DEFAULT_MAP_DISPLAY_STATUSES.has(ds) || (isHistory && isFocused);
      })
      .reduce((map, b) => {
        const ds = getDisplayStatus(b);
        const lat = b.latitude!;
        const lng = b.longitude!;
        const title = b.activityTitle ?? "Activity";
        const key = makeActivityGroupKey(b, ds);

        const existing = map.get(key);
        if (existing) {
          existing.bookings.push(b);
        } else {
          map.set(key, {
            id: key,
            lat,
            lng,
            title,
            displayStatus: ds,
            bookings: [b],
          });
        }

        return map;
      }, new Map<string, MapBookingGroup>())
      .values()
  );

  // ── Load ──────────────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    setState("loading"); setErr("");
    try {
      const data = await BookingApi.listMyBookingsWithDetails();
      setBookings(data);
      setState("done");
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Failed to load bookings");
      setState("error");
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 4200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    setGuestNamesByBooking((prev) => {
      const next: Record<string, string[]> = {};
      for (const b of bookings) {
        next[b.id] = prev[b.id]
          ? resizeGuestNames(prev[b.id], b.numberOfPeople, mainGuestName)
          : getEditableGuestNames(b, mainGuestName);
      }
      return next;
    });
  }, [bookings, mainGuestName]);

  useEffect(() => {
    if (!isAdventurer || !user?.id) {
      setGuideReviewEligibilityByBooking({});
      setGuideReviewEligibilityLoading(new Set());
      return;
    }

    const candidates = bookings.filter((b) => {
      const ds = getDisplayStatus(b);
      return ds === "COMPLETED" && Boolean(b.guideId) && b.guideId !== user.id;
    });

    if (!candidates.length) {
      setGuideReviewEligibilityByBooking({});
      setGuideReviewEligibilityLoading(new Set());
      return;
    }

    let alive = true;
    setGuideReviewEligibilityLoading(new Set(candidates.map((b) => b.id)));

    async function loadGuideReviewEligibility() {
      const entries = await Promise.all(
        candidates.map(async (b) => {
          try {
            const eligibility = await GuideReviewApi.getGuideReviewEligibility(b.guideId!, b.id);
            return [b.id, eligibility] as const;
          } catch (e: unknown) {
            return [b.id, {
              eligible: false,
              alreadyReviewed: false,
              reason: e instanceof Error ? e.message : "Guide review is not available.",
            } satisfies GuideReviewEligibility] as const;
          }
        })
      );

      if (!alive) return;
      setGuideReviewEligibilityByBooking(Object.fromEntries(entries));
      setGuideReviewEligibilityLoading(new Set());
    }

    void loadGuideReviewEligibility();

    return () => {
      alive = false;
    };
  }, [bookings, isAdventurer, user?.id]);

  // ── Selection ─────────────────────────────────────────────────────────────
  function selectBooking(b: BookingWithDetails) {
    if (selectedId === b.id) {
      deselectBooking();
      return;
    }

    setSelectedId(b.id);
    if (b.latitude != null && b.longitude != null) {
      setFlyTarget({ lat: b.latitude, lng: b.longitude });
    }
    const el = cardRefs.current.get(b.id);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  function deselectBooking() { setSelectedId(null); setFlyTarget(null); }

  function toggleSection(id: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function setRefForBookings(groupBookings: BookingWithDetails[], el: HTMLButtonElement | null) {
    groupBookings.forEach((b) => {
      if (el) cardRefs.current.set(b.id, el);
      else cardRefs.current.delete(b.id);
    });
  }

  // ── Actions ───────────────────────────────────────────────────────────────
  function setGuestNameForBooking(bookingId: string, index: number, value: string) {
    setGuestNamesByBooking((prev) => {
      const booking = bookings.find((b) => b.id === bookingId);
      const count = booking?.numberOfPeople ?? prev[bookingId]?.length ?? 1;
      const current = resizeGuestNames(prev[bookingId], count, mainGuestName);
      current[index] = value;
      return { ...prev, [bookingId]: current };
    });
    setGuestNameErrors((prev) => {
      if (!prev[bookingId]) return prev;
      const next = { ...prev };
      delete next[bookingId];
      return next;
    });
  }

  async function openCancelPreview(bookingId: string) {
    setCancelTarget(bookingId);
    setCancelPreview(null);
    setCancelPreviewError("");
    setCancelPreviewLoading(true);
    try {
      setCancelPreview(await BookingApi.getRefundPreview(bookingId));
    } catch (e: unknown) {
      setCancelPreviewError(e instanceof Error ? e.message : "Could not load refund preview");
    } finally {
      setCancelPreviewLoading(false);
    }
  }

  async function saveGuestNamesForPayment(b: BookingWithDetails): Promise<boolean> {
    const names = resizeGuestNames(
      guestNamesByBooking[b.id] ?? getEditableGuestNames(b, mainGuestName),
      b.numberOfPeople,
      mainGuestName
    ).map((name) => name.trim());

    if (names.some((name) => !name)) {
      const message = "Please fill every guest name before payment.";
      setGuestNameErrors((prev) => ({ ...prev, [b.id]: message }));
      alert(message);
      return false;
    }

    try {
      const updated = await BookingApi.updateBookingGuestNames(b.id, names);
      setGuestNamesByBooking((prev) => ({ ...prev, [b.id]: names }));
      setBookings((prev) => prev.map((booking) => (
        booking.id === b.id
          ? { ...booking, ...updated, guestNames: names.slice(1) }
          : booking
      )));
      return true;
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Could not save guest names";
      setGuestNameErrors((prev) => ({ ...prev, [b.id]: message }));
      alert(message);
      return false;
    }
  }

  async function onPay(id: string) {
    setBusyId(id);
    try {
      const booking = bookings.find((b) => b.id === id);
      if (booking && (booking.status === "PENDING" || booking.status === "PAYING")) {
        const saved = await saveGuestNamesForPayment(booking);
        if (!saved) {
          setBusyId(null);
          return;
        }
      }
      const res = await BookingApi.createStripePayment(id);
      if (!res.checkoutUrl) throw new Error("Missing checkout URL");
      window.location.href = res.checkoutUrl;
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Could not start payment");
      setBusyId(null);
    }
  }

  async function onInc(id: string) {
    setBusyId(id);
    try {
      const updated = await BookingApi.increaseBookingSeats(id, 1);
      setBookings((prev) => prev.map((b) => (b.id === id ? { ...b, ...updated } : b)));
    } finally { setBusyId(null); }
  }

  async function onDec(id: string, current: number) {
    if (current <= 1) return;
    setBusyId(id);
    try {
      const updated = await BookingApi.decreaseBookingSeats(id, 1);
      setBookings((prev) => prev.map((b) => (b.id === id ? { ...b, ...updated } : b)));
    } finally { setBusyId(null); }
  }

  async function confirmCancel() {
    if (!cancelTarget) return;
    setBusyId(cancelTarget);
    try {
      await BookingApi.cancelBooking(cancelTarget);
      await load();
      if (selectedId === cancelTarget) deselectBooking();
      setToast({ tone: "success", message: "Booking cancelled. Refund details are updated in your booking." });
    } catch (e: unknown) {
      setToast({ tone: "error", message: e instanceof Error ? e.message : "Could not cancel booking" });
    } finally {
      setBusyId(null);
      setCancelTarget(null);
      setCancelPreview(null);
      setCancelPreviewError("");
    }
  }

  async function confirmAdjustGuests(nextCount: number) {
    if (!adjustTarget || nextCount === adjustTarget.numberOfPeople) return;
    const delta = Math.abs(nextCount - adjustTarget.numberOfPeople);
    setBusyId(adjustTarget.id);
    try {
      if (nextCount > adjustTarget.numberOfPeople) {
        await BookingApi.increaseBookingSeats(adjustTarget.id, delta);
      } else {
        await BookingApi.decreaseBookingSeats(adjustTarget.id, delta);
      }
      await load();
      setAdjustTarget(null);
    } finally {
      setBusyId(null);
    }
  }

  async function viewGuestPasses(b: BookingWithDetails) {
    if (passesByBooking[b.id]) return;

    setPassLoadingId(b.id);
    setPassErrors((prev) => {
      const next = { ...prev };
      delete next[b.id];
      return next;
    });

    try {
      const passes = await GuestPassApi.getGuestPassesForBooking(b.id);
      setPassesByBooking((prev) => ({ ...prev, [b.id]: passes }));
    } catch (e: unknown) {
      setPassErrors((prev) => ({
        ...prev,
        [b.id]: e instanceof Error ? e.message : "Could not load guest passes",
      }));
    } finally {
      setPassLoadingId(null);
    }
  }

  // ── Map legend display statuses ───────────────────────────────────────────
  function openReviewModal(b: BookingWithDetails) {
    if (b.alreadyReviewed) {
      setToast({ tone: "info", message: b.reviewReason || "You already reviewed this activity." });
      return;
    }

    if (!b.reviewEligible) {
      setToast({ tone: "error", message: b.reviewReason || "This booking is not eligible for review." });
      return;
    }

    setReviewTarget(b);
  }

  function openGuideReviewModal(b: BookingWithDetails) {
    if (!isAdventurer) {
      setToast({ tone: "error", message: "Only adventurers can review guides." });
      return;
    }

    if (!b.guideId) {
      setToast({ tone: "error", message: "Guide information is not available for this booking." });
      return;
    }

    if (b.guideId === user?.id) {
      setToast({ tone: "error", message: "You cannot review yourself as a guide." });
      return;
    }

    const eligibility = guideReviewEligibilityByBooking[b.id];
    if (!eligibility?.eligible) {
      setToast({
        tone: eligibility?.alreadyReviewed ? "info" : "error",
        message: eligibility?.reason || "This booking is not eligible for a guide review.",
      });
      return;
    }

    setGuideReviewTarget(b);
  }

  async function submitReview(data: { rating: number; comment: string }) {
    if (!reviewTarget) return;
    const booking = reviewTarget;

    try {
      const review = await ReviewApi.createReview({
        bookingId: booking.id,
        rating: data.rating,
        comment: data.comment,
      });

      setBookings((prev) => prev.map((item) => (
        item.id === booking.id
          ? {
              ...item,
              reviewEligible: false,
              alreadyReviewed: true,
              reviewId: review.id,
              reviewReason: "You already reviewed this activity.",
            }
          : item
      )));
      setReviewTarget(null);
      setToast({ tone: "success", message: "Review posted. Thanks for sharing your experience." });
    } catch (e: unknown) {
      setToast({
        tone: "error",
        message: e instanceof Error ? e.message : "Could not submit review.",
      });
      throw e;
    }
  }

  async function submitGuideReview(data: { rating: number; comment: string }) {
    if (!guideReviewTarget?.guideId) return;
    const booking = guideReviewTarget;
    const guideId = guideReviewTarget.guideId;

    setBusyId(booking.id);
    try {
      const review = await GuideReviewApi.createGuideReview(guideId, {
        bookingId: booking.id,
        rating: data.rating,
        comment: data.comment,
      });

      setGuideReviewEligibilityByBooking((prev) => ({
        ...prev,
        [booking.id]: {
          eligible: false,
          alreadyReviewed: true,
          existingReviewId: review.id,
          reason: "You already reviewed this guide for this booking.",
        },
      }));
      setGuideReviewTarget(null);
      setToast({ tone: "success", message: "Guide review posted. Thanks for recognizing great guiding." });
    } catch (e: unknown) {
      setToast({
        tone: "error",
        message: e instanceof Error ? e.message : "Could not submit guide review.",
      });
      throw e;
    } finally {
      setBusyId(null);
    }
  }

  const hoveredOrSelectedBooking = bookings.find((b) => b.id === hoveredId || b.id === selectedId) ?? null;
  const hoveredOrSelectedStatus = hoveredOrSelectedBooking ? getDisplayStatus(hoveredOrSelectedBooking) : null;
  const shouldShowHistoryLegend =
    activeFilter === "HISTORY" ||
    hoveredOrSelectedStatus === "CANCELLED" ||
    hoveredOrSelectedStatus === "EXPIRED";

  const legendStatuses: DisplayStatus[] = activeFilter === "HISTORY"
    ? ["CANCELLED", "EXPIRED"]
    : shouldShowHistoryLegend
    ? ["UPCOMING", "COMPLETED", "CANCELLED", "EXPIRED"]
    : ["UPCOMING", "COMPLETED"];

  return (
    <>
      <Header />

      {toast && (
        <PageToast
          tone={toast.tone}
          message={toast.message}
          onClose={() => setToast(null)}
        />
      )}

      {cancelBooking && (
        <CancelBookingModal
          b={cancelBooking}
          preview={cancelPreview}
          previewLoading={cancelPreviewLoading}
          previewError={cancelPreviewError}
          onConfirm={confirmCancel}
          onDismiss={() => {
            setCancelTarget(null);
            setCancelPreview(null);
            setCancelPreviewError("");
          }}
          busy={busyId === cancelTarget}
        />
      )}

      {payTarget && (
        <PayNowModal
          b={payTarget}
          onConfirm={() => onPay(payTarget.id)}
          onDismiss={() => setPayTarget(null)}
          busy={busyId === payTarget.id}
        />
      )}

      {adjustTarget && (
        <AdjustGuestsModal
          b={adjustTarget}
          onConfirm={confirmAdjustGuests}
          onDismiss={() => setAdjustTarget(null)}
          busy={busyId === adjustTarget.id}
        />
      )}

      {reviewTarget && (
        <ReviewBookingModal
          booking={reviewTarget}
          onDismiss={() => setReviewTarget(null)}
          onSubmit={submitReview}
        />
      )}

      {guideReviewTarget && (
        <GuideReviewModal
          booking={guideReviewTarget}
          busy={busyId === guideReviewTarget.id}
          onDismiss={() => setGuideReviewTarget(null)}
          onSubmit={submitGuideReview}
        />
      )}

      <div className={styles.shell}>

        {/* ── COMPACT HERO BAR ──────────────────────────────────────────── */}
        <header className={styles.pageHeader}>
          <div className={styles.headerLeft}>
            <h1 className={styles.headerTitle}>Where I've been</h1>
            {state === "done" && totalCount > 0 && (
              <div className={styles.statsInline}>
                <span className={styles.statBadge}>
                  {totalCount} trip{totalCount !== 1 ? "s" : ""}
                </span>
                <span className={`${styles.statBadge} ${styles.statBadgeGreen}`}>
                  {completedCount} completed
                </span>
                {upcomingCount > 0 && (
                  <span className={`${styles.statBadge} ${styles.statBadgeAmber}`}>
                    {upcomingCount} upcoming
                  </span>
                )}
              </div>
            )}
          </div>

          <div className={styles.headerRight}>
            <div className={styles.viewToggle} role="group" aria-label="View mode">
              <button
                className={`${styles.toggleBtn} ${viewMode === "map" ? styles.toggleActive : ""}`}
                onClick={() => setViewMode("map")} type="button"
              >
                <IcoMap /> Map
              </button>
              <button
                className={`${styles.toggleBtn} ${viewMode === "list" ? styles.toggleActive : ""}`}
                onClick={() => setViewMode("list")} type="button"
              >
                <IcoList /> List
              </button>
            </div>
            <Link to="/home" className={styles.exploreBtn}>
              Explore <IcoArrow />
            </Link>
          </div>
        </header>

        {/* ── LOADING ───────────────────────────────────────────────────── */}
        {state === "loading" && (
          <div className={styles.loadingShell}>
            <div className={styles.mapSkeleton} />
            <div className={styles.sidebarSkeleton}>
              {[1, 2, 3].map((i) => <div key={i} className={styles.cardSkeleton} />)}
            </div>
          </div>
        )}

        {/* ── ERROR ─────────────────────────────────────────────────────── */}
        {state === "error" && (
          <div className={styles.emptyState}>
            <div className={`${styles.emptyIcon} ${styles.emptyIconErr}`}><IcoAlert /></div>
            <h3 className={styles.emptyTitle}>Couldn't load bookings</h3>
            <p className={styles.emptyBody}>{err}</p>
            <button className={styles.retryBtn} onClick={load} type="button">Try again</button>
          </div>
        )}

        {/* ── EMPTY ─────────────────────────────────────────────────────── */}
        {state === "done" && totalCount === 0 && (
          <div className={styles.emptyState}>
            <div className={styles.emptyIcon}><IcoCompass /></div>
            <h3 className={styles.emptyTitle}>No adventures yet</h3>
            <p className={styles.emptyBody}>
              Your bookings will appear here once you make your first reservation.
            </p>
            <Link to="/home" className={styles.retryBtn}>Find an adventure</Link>
          </div>
        )}

        {/* ── MAIN SPLIT LAYOUT ─────────────────────────────────────────── */}
        {state === "done" && totalCount > 0 && viewMode === "list" && (
          <main className={styles.listPreview}>
            <div className={styles.listContent}>
              <div className={styles.listFilterRow} role="group" aria-label="Filter bookings">
                {FILTER_OPTIONS.map((opt) => (
                  <button
                    key={opt.key}
                    className={`${styles.filterChip} ${activeFilter === opt.key ? styles.filterChipActive : ""}`}
                    onClick={() => setActiveFilter(opt.key)}
                    type="button"
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              {SECTION_GROUPS.filter((section) => section.id !== "paying").map((section) => {
                const sectionBookings = listBookingsBySection[section.id] ?? [];
                if (!sectionBookings.length) return null;
                return (
                  <section className={styles.bookingSection} key={section.id}>
                    <div className={styles.bookingSectionHeader}>
                      <span className={styles.sectionDot} style={{ background: getDisplayCfg(section.displayStatuses[0]).pin }} />
                      <h2>{section.label}</h2>
                      <span>{sectionBookings.length}</span>
                    </div>
                    <div className={styles.bookingGrid}>
                      {sectionBookings.map((booking) => (
                        <PreviewBookingCard
                          key={booking.id}
                          b={booking}
                          selected={selectedId === booking.id}
                          onSelect={selectBooking}
                          onPay={setPayTarget}
                          onCancel={(target) => void openCancelPreview(target.id)}
                          onAdjustGuests={setAdjustTarget}
                          onViewPasses={viewGuestPasses}
                          guestNames={guestNamesByBooking[booking.id] ?? getEditableGuestNames(booking, mainGuestName)}
                          guestNameError={guestNameErrors[booking.id]}
                          onGuestNameChange={setGuestNameForBooking}
                          passes={passesByBooking[booking.id]}
                          passesLoading={passLoadingId === booking.id}
                          passesError={passErrors[booking.id]}
                          onReview={openReviewModal}
                          guideReviewEligibility={guideReviewEligibilityByBooking[booking.id]}
                          guideReviewLoading={guideReviewEligibilityLoading.has(booking.id)}
                          onGuideReview={openGuideReviewModal}
                        />
                      ))}
                    </div>
                  </section>
                );
              })}
            </div>
          </main>
        )}

        {state === "done" && totalCount > 0 && viewMode === "map" && (
          <div className={styles.splitPane}>

            {/* ── MAP PANE ──────────────────────────────────────────────── */}
            <div className={styles.mapPane}>
              <MapContainer
                center={[34.0, 9.0]} zoom={6}
                className={styles.leafletMap}
                zoomControl={false} attributionControl={false}
              >
                {/* CARTO Voyager — clean, readable, subtle terrain hints, readable labels */}
                <TileLayer
                  url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
                  subdomains="abcd"
                  maxZoom={19}
                />

                {flyTarget && <FlyTo lat={flyTarget.lat} lng={flyTarget.lng} />}

                {mapGroups.map((group) => {
                  const main       = group.bookings[0];
                  const ds         = group.displayStatus;
                  const cfg        = getDisplayCfg(ds);
                  const isSelected = group.bookings.some((b) => b.id === selectedId);
                  const isHovered  = group.bookings.some((b) => b.id === hoveredId);
                  const isDimmed   = hoveredId !== null && !isHovered && !isSelected;

                  const sortedGroupBookings = [...group.bookings].sort(sortBookingsBySession);

                  return (
                    <Marker
                      key={group.id}
                      position={[group.lat, group.lng]}
                      icon={createPin(cfg.pin, isSelected || isHovered, isDimmed)}
                      eventHandlers={{
                        click:     () => selectBooking(main),
                        mouseover: () => setHoveredId(main.id),
                        mouseout:  () => setHoveredId(null),
                      }}
                      zIndexOffset={isSelected ? 1000 : isHovered ? 500 : 0}
                    >
                      <Popup className={styles.leafletPopup}>
                        <strong>{group.title}</strong>
                        <br />
                        <span style={{ color: cfg.color, fontSize: "11px", fontWeight: 600 }}>
                          {cfg.label}
                          {group.bookings.length > 1 ? ` · ${group.bookings.length} sessions` : ""}
                        </span>

                        {sortedGroupBookings.map((b) => (
                          <div key={b.id} style={{ marginTop: 6 }}>
                            <small>{fmtDate(b.sessionStartAt)}</small>
                            <br />
                            <button
                              type="button"
                              onClick={() => selectBooking(b)}
                              style={{
                                border: "none",
                                background: "transparent",
                                padding: 0,
                                color: cfg.color,
                                fontWeight: 700,
                                cursor: "pointer",
                                fontSize: 11,
                              }}
                            >
                              View this session
                            </button>
                          </div>
                        ))}

                        {main.governorate && <><br /><small>{main.governorate}</small></>}
                      </Popup>
                    </Marker>
                  );
                })}
              </MapContainer>

              {/* Attribution */}
              <div className={styles.mapAttrib}>
                © <a href="https://carto.com" target="_blank" rel="noreferrer">CARTO</a> ·{" "}
                © <a href="https://openstreetmap.org" target="_blank" rel="noreferrer">OSM</a>
              </div>

              {/* Map legend — only meaningful statuses */}
              <div className={styles.mapLegend}>
                {legendStatuses.map((ds) => {
                  const cfg = getDisplayCfg(ds);
                  return (
                    <button
                      key={ds}
                      className={`${styles.legendItem} ${
                        (activeFilter === "UPCOMING" && ds === "UPCOMING") ||
                        (activeFilter === "CONFIRMED" && ds === "COMPLETED") ||
                        (activeFilter === "HISTORY" && (ds === "CANCELLED" || ds === "EXPIRED"))
                          ? styles.legendItemActive
                          : ""
                      }`}
                      onClick={() => {
                        if (ds === "UPCOMING") {
                          setActiveFilter((p) => (p === "UPCOMING" ? "ALL" : "UPCOMING"));
                        } else if (ds === "COMPLETED") {
                          setActiveFilter((p) => (p === "CONFIRMED" ? "ALL" : "CONFIRMED"));
                        } else if (ds === "CANCELLED" || ds === "EXPIRED") {
                          setActiveFilter((p) => (p === "HISTORY" ? "ALL" : "HISTORY"));
                        }
                      }}
                      type="button"
                    >
                      <span className={styles.legendDot} style={{ background: cfg.pin }} />
                      <span>{cfg.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* ── SIDEBAR ───────────────────────────────────────────────── */}
            <aside className={styles.sidebar}>

              {/* Paying notice — ephemeral top banner */}
              <PayingNotice count={payingCount} />

              {/* Filter chips */}
              <div className={styles.filterRow} role="group" aria-label="Filter bookings">
                {FILTER_OPTIONS.map((opt) => {
                  const count =
                    opt.key === "UPCOMING"
                      ? upcomingCount
                      : opt.key === "CONFIRMED"
                      ? confirmedCount
                      : opt.key === "HISTORY"
                      ? historyCount
                      : totalCount;

                  const chipColor =
                    opt.key === "UPCOMING"
                      ? DISPLAY_STATUS_CONFIG.UPCOMING.color
                      : opt.key === "CONFIRMED"
                      ? DISPLAY_STATUS_CONFIG.COMPLETED.color
                      : opt.key === "HISTORY"
                      ? DISPLAY_STATUS_CONFIG.EXPIRED.color
                      : "#40916c";

                  const chipBg =
                    opt.key === "UPCOMING"
                      ? DISPLAY_STATUS_CONFIG.UPCOMING.bg
                      : opt.key === "CONFIRMED"
                      ? DISPLAY_STATUS_CONFIG.COMPLETED.bg
                      : opt.key === "HISTORY"
                      ? DISPLAY_STATUS_CONFIG.EXPIRED.bg
                      : "rgba(64,145,108,0.10)";

                  return (
                    <button
                      key={opt.key}
                      className={`${styles.filterChip} ${activeFilter === opt.key ? styles.filterChipActive : ""}`}
                      onClick={() => setActiveFilter(opt.key)}
                      style={{ "--chip-color": chipColor, "--chip-bg": chipBg } as CSSProperties}
                      type="button"
                    >
                      {opt.label}
                      <span className={styles.filterChipCount}>{count}</span>
                    </button>
                  );
                })}
              </div>

              {/* Grouped sections */}
              <div className={styles.sidebarList}>
                {SECTION_GROUPS.map((section) => {
                  const groups = sidebarGroupsBySection[section.id] ?? [];
                  if (!groups.length) return null;

                  const sessionCount = groups.reduce((sum, g) => sum + g.bookings.length, 0);
                  const isCollapsed = collapsed.has(section.id);
                  const dotColor    = getDisplayCfg(section.displayStatuses[0]).pin;

                  return (
                    <div
                      key={section.id}
                      className={`${styles.sectionGroup} ${section.isPaying ? styles.sectionGroupPaying : ""}`}
                    >
                      <button
                        className={styles.sectionHeader}
                        onClick={() => toggleSection(section.id)}
                        type="button"
                        aria-expanded={!isCollapsed}
                      >
                        <span className={styles.sectionDot} style={{ background: dotColor }} />
                        <span className={styles.sectionLabel}>{section.label}</span>
                        <span
                          className={styles.sectionCount}
                          title={`${sessionCount} booked session${sessionCount !== 1 ? "s" : ""}`}
                        >
                          {groups.length}
                        </span>
                        <span className={`${styles.sectionChevron} ${isCollapsed ? styles.sectionChevronClosed : ""}`}>
                          <IcoChevron />
                        </span>
                      </button>

                      {!isCollapsed && (
                        <div className={styles.sectionItems}>
                          {groups.map((bookingGroup) => (
                            <GroupedSidebarCard
                              key={bookingGroup.id}
                              group={bookingGroup}
                              selectedId={selectedId}
                              hoveredId={hoveredId}
                              setRefForBookings={setRefForBookings}
                              onSelect={selectBooking}
                              onHover={setHoveredId}
                              onPay={onPay}
                              onCancel={(id) => void openCancelPreview(id)}
                              onInc={onInc}
                              onDec={onDec}
                              busyId={busyId}
                              isListMode={false}
                              isFeatured={false}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Filter empty state */}
                {displayBookings.length === 0 && (
                  <div className={styles.filterEmpty}>
                    <p>No matching bookings</p>
                    <button
                      className={styles.clearFilter}
                      onClick={() => setActiveFilter("ALL")}
                      type="button"
                    >
                      Show all bookings
                    </button>
                  </div>
                )}
              </div>
              {/* ── DETAIL DRAWER — scoped inside sidebar column ────── */}
            </aside>
          </div>
        )}
      </div>
    </>
  );
}

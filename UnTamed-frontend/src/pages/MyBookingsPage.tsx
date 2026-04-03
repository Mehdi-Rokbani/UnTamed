// src/pages/MyBookingsPage.tsx
import { useEffect, useMemo, useState, useRef } from "react";
import { Link } from "react-router-dom";
import { Header } from "../components/Header";
import * as BookingApi from "../api/booking.api";
import * as ActivityApi from "../api/activity.api";
import { useAuth } from "../auth/auth.store";
import styles from "../style/my-bookings.module.css";

type LoadState = "loading" | "done" | "error";

// ── Icons ──
const IcoCalendar = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" />
    <line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
  </svg>
);
const IcoUsers = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
  </svg>
);
const IcoExternalLink = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
    <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" />
    <polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" />
  </svg>
);
const IcoCheck = () => (
  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);
const IcoX = () => (
  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);
const IcoClock = () => (
  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
    <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
  </svg>
);
const IcoMapPin = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" /><circle cx="12" cy="10" r="3" />
  </svg>
);
const IcoCompass = () => (
  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
    <circle cx="12" cy="12" r="10" />
    <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />
  </svg>
);
const IcoAlertTriangle = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
    <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
  </svg>
);
const IcoChevronDown = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
    <polyline points="6 9 12 15 18 9" />
  </svg>
);
const IcoArrowRight = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
    <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
  </svg>
);

// ── Status config ──
type BookingStatus = "PENDING" | "CONFIRMED" | "COMPLETED" | "CANCELLED" | string;

const STATUS_CONFIG: Record<string, { label: string; icon: React.ReactNode; cls: string }> = {
  PENDING:   { label: "Pending",   icon: <IcoClock />,  cls: "statusPending"   },
  CONFIRMED: { label: "Confirmed", icon: <IcoCheck />,  cls: "statusConfirmed" },
  COMPLETED: { label: "Completed", icon: <IcoCheck />,  cls: "statusCompleted" },
  CANCELLED: { label: "Cancelled", icon: <IcoX />,      cls: "statusCancelled" },
};

function fmtDate(iso?: string) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("en-US", {
    weekday: "short", month: "short", day: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function fmtDateShort(iso?: string) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function timeFromNow(iso?: string) {
  if (!iso) return null;
  const diff = new Date(iso).getTime() - Date.now();
  if (diff <= 0) return null;
  const days = Math.floor(diff / 86400000);
  if (days > 0) return `in ${days}d`;
  const hrs = Math.floor(diff / 3600000);
  return hrs > 0 ? `in ${hrs}h` : "soon";
}

// ── Skeleton ──
function SkeletonActivityCard() {
  return (
    <div className={styles.activityCard}>
      <div className={styles.activityImageWrap}>
        <div className={styles.skeletonImg} />
      </div>
      <div className={styles.activityContent}>
        <div className={styles.skeletonLine} style={{ width: "55%", height: 18 }} />
        <div className={styles.skeletonLine} style={{ width: "35%", height: 13, marginTop: 6 }} />
        <div className={styles.skeletonLine} style={{ width: "100%", height: 52, marginTop: 14, borderRadius: 10 }} />
      </div>
    </div>
  );
}

// ── Cancel Modal ──
function CancelModal({ onConfirm, onDismiss, busy }: {
  onConfirm: () => void; onDismiss: () => void; busy: boolean;
}) {
  const overlayRef = useRef<HTMLDivElement>(null);
  return (
    <div
      className={styles.modalOverlay}
      ref={overlayRef}
      onClick={(e) => { if (e.target === overlayRef.current) onDismiss(); }}
    >
      <div className={styles.modal}>
        <div className={styles.modalIcon}><IcoAlertTriangle /></div>
        <h3 className={styles.modalTitle}>Cancel this booking?</h3>
        <p className={styles.modalBody}>
          This action can't be undone. Your spot will be released and you'll receive a cancellation confirmation.
        </p>
        <div className={styles.modalActions}>
          <button className={styles.modalKeep} onClick={onDismiss} type="button">Keep it</button>
          <button
            className={`${styles.modalCancel} ${busy ? styles.modalBusy : ""}`}
            onClick={onConfirm}
            disabled={busy}
            type="button"
          >
            {busy ? <><div className={styles.btnSpinner} />Cancelling…</> : "Yes, cancel"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Single booking row (inside an activity group) ──
function BookingRow({ b, s, busy, onConfirm, onCancel, onInc, onDec }: {
  b: BookingApi.Booking;
  s: any;
  busy: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  onInc: () => void;
  onDec: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const statusCfg = STATUS_CONFIG[b.status] ?? { label: b.status, icon: null, cls: "statusPending" };
  const isPending = b.status === "PENDING";
  const countdown = timeFromNow(s?.date);

  return (
    <div className={`${styles.bookingRow} ${expanded ? styles.bookingRowExpanded : ""}`}>
      {/* ── Collapsed row ── */}
      <button
        className={styles.bookingRowHeader}
        onClick={() => setExpanded((v) => !v)}
        type="button"
        aria-expanded={expanded}
      >
        <div className={styles.bookingRowLeft}>
          <span className={`${styles.statusDot} ${styles[statusCfg.cls + "Dot"]}`} />
          <div className={styles.bookingRowInfo}>
            <span className={styles.bookingRowDate}>
              <IcoCalendar /> {fmtDate(s?.date)}
            </span>
            <div className={styles.bookingRowMeta}>
              <span><IcoUsers /> {b.numberOfPeople} {b.numberOfPeople === 1 ? "guest" : "guests"}</span>
              <span className={styles.bookingIdBadge}>#{b.id.slice(-6).toUpperCase()}</span>
            </div>
          </div>
        </div>

        <div className={styles.bookingRowRight}>
          {countdown && isPending && (
            <span className={styles.countdownChip}>{countdown}</span>
          )}
          <span className={`${styles.statusPill} ${styles[statusCfg.cls]}`}>
            {statusCfg.icon}{statusCfg.label}
          </span>
          <span className={`${styles.expandIcon} ${expanded ? styles.expandIconOpen : ""}`}>
            <IcoChevronDown />
          </span>
        </div>
      </button>

      {/* ── Expanded actions ── */}
      {expanded && (
        <div className={styles.bookingRowActions}>
          {isPending && (
            <div className={styles.seatRow}>
              <span className={styles.seatLabel}>Adjust guests</span>
              <div className={styles.seatStepper}>
                <button
                  className={styles.stepBtn}
                  onClick={onDec}
                  disabled={busy || b.numberOfPeople <= 1}
                  type="button"
                >−</button>
                <span className={styles.stepVal}>{b.numberOfPeople}</span>
                <button className={styles.stepBtn} onClick={onInc} disabled={busy} type="button">+</button>
              </div>
            </div>
          )}

          <div className={styles.actionBtns}>
            {isPending && (
              <>
                <button
                  className={styles.confirmBtn}
                  onClick={onConfirm}
                  disabled={busy}
                  type="button"
                >
                  {busy ? <><div className={styles.btnSpinnerSm} />Confirming…</> : <><IcoCheck />Confirm</>}
                </button>
                <button
                  className={styles.cancelRowBtn}
                  onClick={onCancel}
                  disabled={busy}
                  type="button"
                >
                  <IcoX />Cancel
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Activity group card ──
function ActivityGroupCard({ title, location, cover, tplId, bookings, sessionsById, busyId, onConfirm, onCancel, onInc, onDec, dimmed }: {
  title: string;
  location?: string;
  cover?: string | null;
  tplId: string | null;
  bookings: BookingApi.Booking[];
  sessionsById: Record<string, any>;
  busyId: string | null;
  onConfirm: (id: string) => void;
  onCancel: (id: string) => void;
  onInc: (id: string) => void;
  onDec: (id: string, current: number) => void;
  dimmed?: boolean;
}) {
  const hasPending = bookings.some((b) => b.status === "PENDING");
  const canRebook = !hasPending && tplId;

  return (
    <div className={`${styles.activityCard} ${dimmed ? styles.cardDimmed : ""}`}>
      {/* Image strip */}
      <div className={styles.activityImageWrap}>
        {cover
          ? <img src={cover} alt={title} className={styles.activityImage} />
          : (
            <div className={styles.activityImagePlaceholder}>
              <IcoCompass />
            </div>
          )}
        <div className={styles.activityImageOverlay} />

        {/* Title overlaid on image */}
        <div className={styles.activityImageMeta}>
          <div className={styles.activityImageTitle}>{title}</div>
          {location && (
            <div className={styles.activityImageLoc}>
              <IcoMapPin />{location}
            </div>
          )}
        </div>

        {/* Open link */}
        {tplId && (
          <Link
            to={`/activities/${tplId}`}
            className={styles.activityOpenLink}
            title="View activity"
            onClick={(e) => e.stopPropagation()}
          >
            <IcoExternalLink />
          </Link>
        )}

        {/* Booking count badge */}
        <div className={styles.bookingCountBadge}>
          {bookings.length} booking{bookings.length !== 1 ? "s" : ""}
        </div>
      </div>

      {/* Booking rows */}
      <div className={styles.bookingRowsList}>
        {bookings.map((b) => (
          <BookingRow
            key={b.id}
            b={b}
            s={sessionsById[b.sessionId] ?? null}
            busy={busyId === b.id}
            onConfirm={() => onConfirm(b.id)}
            onCancel={() => onCancel(b.id)}
            onInc={() => onInc(b.id)}
            onDec={() => onDec(b.id, b.numberOfPeople)}
          />
        ))}

        {/* Rebook footer */}
        {canRebook && (
          <div className={styles.rebookFooter}>
            <Link to={`/activities/${tplId}`} className={styles.rebookLink}>
              Book again <IcoArrowRight />
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main page ──
export default function MyBookingsPage() {
  const [state, setState] = useState<LoadState>("loading");
  const [err, setErr] = useState<string | null>(null);
  const [bookings, setBookings] = useState<BookingApi.Booking[]>([]);
  const [sessionsById, setSessionsById] = useState<Record<string, any>>({});
  const [templatesById, setTemplatesById] = useState<Record<string, any>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [cancelTarget, setCancelTarget] = useState<string | null>(null);
  const { refreshMe } = useAuth();

  const loadAll = async () => {
    setState("loading");
    setErr(null);
    try {
      const bs = await BookingApi.listMyBookings();
      setBookings(bs ?? []);
      const uniqueSessionIds = Array.from(new Set((bs ?? []).map((b) => b.sessionId)));
      const sessionPairs = await Promise.all(
        uniqueSessionIds.map(async (sid) => {
          try { return [sid, await ActivityApi.getSessionById(sid)] as const; }
          catch { return [sid, null] as const; }
        })
      );
      const sMap: Record<string, any> = {};
      for (const [sid, s] of sessionPairs) if (s) sMap[sid] = s;
      setSessionsById(sMap);

      const uniqueTemplateIds = Array.from(
        new Set(Object.values(sMap).map((s: any) => s.templateId).filter(Boolean))
      );
      const tplPairs = await Promise.all(
        uniqueTemplateIds.map(async (tid) => {
          try { return [tid, await ActivityApi.getPublicTemplateById(tid)] as const; }
          catch { return [tid, null] as const; }
        })
      );
      const tMap: Record<string, any> = {};
      for (const [tid, t] of tplPairs) if (t) tMap[tid] = t;
      setTemplatesById(tMap);
      setState("done");
    } catch (e: any) {
      setErr(e?.message ?? "Failed to load bookings");
      setState("error");
    }
  };

  useEffect(() => { loadAll(); }, []);

  // Build rows
  const rows = useMemo(() => bookings.map((b) => {
    const s = sessionsById[b.sessionId] ?? null;
    const tplId = s?.templateId ?? null;
    const t = tplId ? templatesById[tplId] : null;
    return { b, s, t, tplId };
  }), [bookings, sessionsById, templatesById]);

  // Group by templateId, then split upcoming vs past
  const { upcomingGroups, pastGroups } = useMemo(() => {
    const now = Date.now();
    const upcomingRows: typeof rows = [];
    const pastRows: typeof rows = [];

    for (const row of rows) {
      const ts = row.s?.date ? new Date(row.s.date).getTime() : null;
      const cancelled = row.b.status === "CANCELLED";
      if (!cancelled && ts !== null && ts > now) upcomingRows.push(row);
      else pastRows.push(row);
    }

    const groupBy = (rowList: typeof rows) => {
      const map = new Map<string, typeof rows>();
      for (const row of rowList) {
        const key = row.tplId ?? `no-template-${row.b.sessionId}`;
        if (!map.has(key)) map.set(key, []);
        map.get(key)!.push(row);
      }
      return Array.from(map.entries()).map(([key, rows]) => ({
        key,
        tplId: rows[0].tplId,
        t: rows[0].t,
        rows,
      }));
    };

    return {
      upcomingGroups: groupBy(upcomingRows),
      pastGroups: groupBy(pastRows),
    };
  }, [rows]);

  const coverOf = (t: any) => {
    const imgs = t?.images;
    if (imgs?.length) return imgs[0].url;
    return t?.coverImageUrl ?? null;
  };

  async function onInc(id: string) {
    setBusyId(id);
    try {
      const updated = await BookingApi.increaseBookingSeats(id, 1);
      setBookings((prev) => prev.map((x) => (x.id === id ? updated : x)));
    } finally { setBusyId(null); }
  }

  async function onConfirm(id: string) {
    setBusyId(id);
    try {
      const updated = await BookingApi.confirmBooking(id);
      setBookings((prev) => prev.map((x) => (x.id === id ? updated : x)));
      await refreshMe();
    } finally { setBusyId(null); }
  }

  async function onDec(id: string, current: number) {
    if (current <= 1) return;
    setBusyId(id);
    try {
      const updated = await BookingApi.decreaseBookingSeats(id, 1);
      setBookings((prev) => prev.map((x) => (x.id === id ? updated : x)));
    } finally { setBusyId(null); }
  }

  async function confirmCancel() {
    if (!cancelTarget) return;
    setBusyId(cancelTarget);
    try {
      await BookingApi.cancelBooking(cancelTarget);
      await loadAll();
    } finally {
      setBusyId(null);
      setCancelTarget(null);
    }
  }

  const totalCount = rows.length;

  return (
    <>
      <Header />
      {cancelTarget && (
        <CancelModal
          onConfirm={confirmCancel}
          onDismiss={() => setCancelTarget(null)}
          busy={busyId === cancelTarget}
        />
      )}

      <main className={styles.root}>
        {/* Page header */}
        <div className={styles.pageHeader}>
          <div>
            <h1 className={styles.pageTitle}>My Bookings</h1>
            {state === "done" && totalCount > 0 && (
              <p className={styles.pageSubtitle}>
                {totalCount} booking{totalCount !== 1 ? "s" : ""} across{" "}
                {upcomingGroups.length + pastGroups.length} activit
                {upcomingGroups.length + pastGroups.length !== 1 ? "ies" : "y"}
              </p>
            )}
          </div>
          <Link to="/home" className={styles.exploreLink}>Explore adventures</Link>
        </div>

        {/* Loading */}
        {state === "loading" && (
          <div className={styles.sections}>
            <div className={styles.sectionHeader}>
              <span className={styles.sectionLabel}>Upcoming</span>
            </div>
            <div className={styles.grid}>
              <SkeletonActivityCard />
              <SkeletonActivityCard />
            </div>
          </div>
        )}

        {/* Error */}
        {state === "error" && (
          <div className={styles.emptyState}>
            <div className={styles.emptyIcon} style={{ color: "#c4360c" }}><IcoAlertTriangle /></div>
            <h3 className={styles.emptyTitle}>Couldn't load bookings</h3>
            <p className={styles.emptyBody}>{err}</p>
            <button className={styles.emptyBtn} onClick={loadAll} type="button">Try again</button>
          </div>
        )}

        {/* Empty */}
        {state === "done" && totalCount === 0 && (
          <div className={styles.emptyState}>
            <div className={styles.emptyIcon}><IcoCompass /></div>
            <h3 className={styles.emptyTitle}>No adventures yet</h3>
            <p className={styles.emptyBody}>
              Your upcoming and past bookings will appear here once you make your first booking.
            </p>
            <Link to="/home" className={styles.emptyBtn}>Find an adventure</Link>
          </div>
        )}

        {/* Content */}
        {state === "done" && totalCount > 0 && (
          <div className={styles.sections}>
            {upcomingGroups.length > 0 && (
              <section>
                <div className={styles.sectionHeader}>
                  <span className={styles.sectionLabel}>Upcoming</span>
                  <span className={styles.sectionCount}>{upcomingGroups.length}</span>
                </div>
                <div className={styles.grid}>
                  {upcomingGroups.map(({ key, tplId, t, rows }) => (
                    <ActivityGroupCard
                      key={key}
                      title={t?.title ?? "Activity"}
                      location={t?.governorate}
                      cover={coverOf(t)}
                      tplId={tplId}
                      bookings={rows.map((r) => r.b)}
                      sessionsById={sessionsById}
                      busyId={busyId}
                      onConfirm={onConfirm}
                      onCancel={(id) => setCancelTarget(id)}
                      onInc={onInc}
                      onDec={onDec}
                    />
                  ))}
                </div>
              </section>
            )}

            {pastGroups.length > 0 && (
              <section style={{ marginTop: upcomingGroups.length ? 48 : 0 }}>
                <div className={styles.sectionHeader}>
                  <span className={styles.sectionLabel}>Past & Cancelled</span>
                  <span className={styles.sectionCount}>{pastGroups.length}</span>
                </div>
                <div className={styles.grid}>
                  {pastGroups.map(({ key, tplId, t, rows }) => (
                    <ActivityGroupCard
                      key={key}
                      title={t?.title ?? "Activity"}
                      location={t?.governorate}
                      cover={coverOf(t)}
                      tplId={tplId}
                      bookings={rows.map((r) => r.b)}
                      sessionsById={sessionsById}
                      busyId={busyId}
                      onConfirm={onConfirm}
                      onCancel={(id) => setCancelTarget(id)}
                      onInc={onInc}
                      onDec={onDec}
                      dimmed
                    />
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </main>
    </>
  );
}
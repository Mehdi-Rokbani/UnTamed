// src/pages/MyBookingsPage.tsx
import { useEffect, useMemo, useState, useRef } from "react";
import { Link } from "react-router-dom";
import { Header } from "../components/Header";
import * as BookingApi from "../api/booking.api";
import * as ActivityApi from "../api/activity.api";
import styles from "../style/my-bookings.module.css";

type LoadState = "loading" | "done" | "error";

// ── Icons ──
const IcoCalendar = () => (<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>);
const IcoUsers = () => (<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" /></svg>);
const IcoExternalLink = () => (<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" /><polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" /></svg>);
const IcoCheck = () => (<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><polyline points="20 6 9 17 4 12" /></svg>);
const IcoX = () => (<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>);
const IcoClock = () => (<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>);
const IcoCompass = () => (<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><circle cx="12" cy="12" r="10" /><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" /></svg>);
const IcoAlertTriangle = () => (<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>);

// ── Status config ──
type BookingStatus = "PENDING" | "CONFIRMED" | "CANCELLED" | string;
const STATUS_CONFIG: Record<string, { label: string; icon: React.ReactNode; cls: string }> = {
  PENDING:   { label: "Pending",   icon: <IcoClock />,  cls: "statusPending" },
  CONFIRMED: { label: "Confirmed", icon: <IcoCheck />,  cls: "statusConfirmed" },
  CANCELLED: { label: "Cancelled", icon: <IcoX />,      cls: "statusCancelled" },
};

function fmtDate(iso?: string) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function fmtDateShort(iso?: string) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

// ── Skeleton card ──
function SkeletonCard() {
  return (
    <div className={styles.bookingCard}>
      <div className={styles.cardImageWrap}><div className={styles.skeletonImg} /></div>
      <div className={styles.cardBody}>
        <div className={styles.skeletonLine} style={{ width: "60%", height: 20 }} />
        <div className={styles.skeletonLine} style={{ width: "40%", height: 14, marginTop: 8 }} />
        <div className={styles.skeletonLine} style={{ width: "80%", height: 14, marginTop: 8 }} />
        <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
          <div className={styles.skeletonLine} style={{ width: 80, height: 34, borderRadius: 8 }} />
          <div className={styles.skeletonLine} style={{ width: 80, height: 34, borderRadius: 8 }} />
        </div>
      </div>
    </div>
  );
}

// ── Confirmation modal ──
function CancelModal({ onConfirm, onDismiss, busy }: { onConfirm: () => void; onDismiss: () => void; busy: boolean }) {
  const overlayRef = useRef<HTMLDivElement>(null);
  return (
    <div className={styles.modalOverlay} ref={overlayRef} onClick={(e) => { if (e.target === overlayRef.current) onDismiss(); }}>
      <div className={styles.modal}>
        <div className={styles.modalIcon}><IcoAlertTriangle /></div>
        <h3 className={styles.modalTitle}>Cancel this booking?</h3>
        <p className={styles.modalBody}>This action can't be undone. Your spot will be released and you'll receive a cancellation confirmation.</p>
        <div className={styles.modalActions}>
          <button className={styles.modalKeep} onClick={onDismiss} type="button">Keep it</button>
          <button className={`${styles.modalCancel} ${busy ? styles.modalBusy : ""}`} onClick={onConfirm} disabled={busy} type="button">
            {busy ? <><div className={styles.btnSpinner} /> Cancelling...</> : "Yes, cancel"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function MyBookingsPage() {
  const [state, setState] = useState<LoadState>("loading");
  const [err, setErr] = useState<string | null>(null);
  const [bookings, setBookings] = useState<BookingApi.Booking[]>([]);
  const [sessionsById, setSessionsById] = useState<Record<string, any>>({});
  const [templatesById, setTemplatesById] = useState<Record<string, any>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [cancelTarget, setCancelTarget] = useState<string | null>(null);

  const loadAll = async () => {
    setState("loading");
    setErr(null);
    try {
      const bs = await BookingApi.listMyBookings();
      setBookings(bs ?? []);
      const uniqueSessionIds = Array.from(new Set((bs ?? []).map((b) => b.sessionId)));
      const sessionPairs = await Promise.all(uniqueSessionIds.map(async (sid) => {
        try { return [sid, await ActivityApi.getSessionById(sid)] as const; }
        catch { return [sid, null] as const; }
      }));
      const sMap: Record<string, any> = {};
      for (const [sid, s] of sessionPairs) if (s) sMap[sid] = s;
      setSessionsById(sMap);

      const uniqueTemplateIds = Array.from(new Set(Object.values(sMap).map((s: any) => s.templateId).filter(Boolean)));
      const tplPairs = await Promise.all(uniqueTemplateIds.map(async (tid) => {
        try { return [tid, await ActivityApi.getPublicTemplateById(tid)] as const; }
        catch { return [tid, null] as const; }
      }));
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

  const rows = useMemo(() => bookings.map((b) => {
    const s = sessionsById[b.sessionId] ?? null;
    const tplId = s?.templateId ?? null;
    const t = tplId ? templatesById[tplId] : null;
    return { b, s, t, tplId };
  }), [bookings, sessionsById, templatesById]);

  // Group into upcoming / past
  const { upcoming, past } = useMemo(() => {
    const now = Date.now();
    const upcoming: typeof rows = [];
    const past: typeof rows = [];
    for (const row of rows) {
      const ts = row.s?.date ? new Date(row.s.date).getTime() : null;
      const cancelled = row.b.status === "CANCELLED";
      if (!cancelled && ts !== null && ts > now) upcoming.push(row);
      else past.push(row);
    }
    // Sort upcoming ASC, past DESC
    upcoming.sort((a, b) => new Date(a.s?.date ?? 0).getTime() - new Date(b.s?.date ?? 0).getTime());
    past.sort((a, b) => new Date(b.s?.date ?? 0).getTime() - new Date(a.s?.date ?? 0).getTime());
    return { upcoming, past };
  }, [rows]);

  async function onInc(id: string) {
    setBusyId(id);
    try {
      const updated = await BookingApi.increaseBookingSeats(id, 1);
      setBookings((prev) => prev.map((x) => (x.id === id ? updated : x)));
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

  const coverOf = (t: any) => {
    const imgs = t?.images;
    if (imgs?.length) return imgs[0].url;
    return t?.coverImageUrl ?? null;
  };

  // ── Render a single booking card ──
  function BookingCard({ b, s, t, tplId, dimmed = false }: { b: BookingApi.Booking; s: any; t: any; tplId: string | null; dimmed?: boolean }) {
    const statusCfg = STATUS_CONFIG[b.status] ?? { label: b.status, icon: null, cls: "statusPending" };
    const cover = coverOf(t);
    const price = Number(t?.price ?? 0);
    const total = price * b.numberOfPeople;
    const canModify = b.status === "PENDING";
    const busy = busyId === b.id;

    return (
      <div className={`${styles.bookingCard} ${dimmed ? styles.cardDimmed : ""}`}>
        {/* Image */}
        <div className={styles.cardImageWrap}>
          {cover
            ? <img src={cover} alt={t?.title ?? "Activity"} className={styles.cardImage} />
            : <div className={styles.cardImagePlaceholder}><IcoCompass /></div>}
          <span className={`${styles.statusBadge} ${styles[statusCfg.cls]}`}>
            {statusCfg.icon}{statusCfg.label}
          </span>
        </div>

        {/* Body */}
        <div className={styles.cardBody}>
          <div className={styles.cardHeaderRow}>
            <div>
              <h3 className={styles.cardTitle}>{t?.title ?? "Activity"}</h3>
              {t?.governorate && <div className={styles.cardLocation}>{t.governorate}</div>}
            </div>
            {tplId && (
              <Link className={styles.cardOpenLink} to={`/activities/${tplId}`} title="View activity">
                <IcoExternalLink />
              </Link>
            )}
          </div>

          <div className={styles.cardMeta}>
            <span className={styles.cardMetaItem}><IcoCalendar /> {s?.date ? fmtDate(s.date) : "—"}</span>
            <span className={styles.cardMetaDot} />
            <span className={styles.cardMetaItem}><IcoUsers /> {b.numberOfPeople} {b.numberOfPeople === 1 ? "guest" : "guests"}</span>
            {price > 0 && <><span className={styles.cardMetaDot} /><span className={styles.cardMetaItem}>{total} TND</span></>}
          </div>

          <div className={styles.cardFooter}>
            {/* Seat stepper — only for PENDING */}
            {canModify && (
              <div className={styles.seatRow}>
                <span className={styles.seatLabel}>Guests</span>
                <div className={styles.seatStepper}>
                  <button className={styles.stepBtn} onClick={() => onDec(b.id, b.numberOfPeople)} disabled={busy || b.numberOfPeople <= 1} type="button">−</button>
                  <span className={styles.stepVal}>{b.numberOfPeople}</span>
                  <button className={styles.stepBtn} onClick={() => onInc(b.id)} disabled={busy} type="button">+</button>
                </div>
              </div>
            )}

            <div className={styles.cardActions}>
              {canModify && (
                <button
                  className={styles.cancelBtn}
                  onClick={() => setCancelTarget(b.id)}
                  disabled={busy}
                  type="button"
                >
                  Cancel booking
                </button>
              )}
              {!canModify && tplId && (
                <Link to={`/activities/${tplId}`} className={styles.rebookBtn}>
                  Book again
                </Link>
              )}
              <div className={styles.bookingIdChip}>#{b.id.slice(-8).toUpperCase()}</div>
            </div>
          </div>
        </div>
      </div>
    );
  }

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
        <div className={styles.pageHeader}>
          <div>
            <h1 className={styles.pageTitle}>My Bookings</h1>
            {state === "done" && rows.length > 0 && (
              <p className={styles.pageSubtitle}>{rows.length} booking{rows.length !== 1 ? "s" : ""} total</p>
            )}
          </div>
          <Link to="/home" className={styles.exploreLink}>Explore adventures</Link>
        </div>

        {/* Loading */}
        {state === "loading" && (
          <div className={styles.sections}>
            <div className={styles.sectionLabel}>Upcoming</div>
            <div className={styles.grid}>{[1, 2].map((i) => <SkeletonCard key={i} />)}</div>
            <div className={styles.sectionLabel} style={{ marginTop: 32 }}>Past</div>
            <div className={styles.grid}>{[1].map((i) => <SkeletonCard key={i} />)}</div>
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
        {state === "done" && rows.length === 0 && (
          <div className={styles.emptyState}>
            <div className={styles.emptyIcon}><IcoCompass /></div>
            <h3 className={styles.emptyTitle}>No adventures yet</h3>
            <p className={styles.emptyBody}>Your upcoming and past bookings will appear here once you make your first booking.</p>
            <Link to="/home" className={styles.emptyBtn}>Find an adventure</Link>
          </div>
        )}

        {/* Content */}
        {state === "done" && rows.length > 0 && (
          <div className={styles.sections}>
            {upcoming.length > 0 && (
              <section>
                <div className={styles.sectionHeader}>
                  <span className={styles.sectionLabel}>Upcoming</span>
                  <span className={styles.sectionCount}>{upcoming.length}</span>
                </div>
                <div className={styles.grid}>
                  {upcoming.map(({ b, s, t, tplId }) => (
                    <BookingCard key={b.id} b={b} s={s} t={t} tplId={tplId} />
                  ))}
                </div>
              </section>
            )}

            {past.length > 0 && (
              <section style={{ marginTop: upcoming.length ? 40 : 0 }}>
                <div className={styles.sectionHeader}>
                  <span className={styles.sectionLabel}>Past & Cancelled</span>
                  <span className={styles.sectionCount}>{past.length}</span>
                </div>
                <div className={styles.grid}>
                  {past.map(({ b, s, t, tplId }) => (
                    <BookingCard key={b.id} b={b} s={s} t={t} tplId={tplId} dimmed />
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
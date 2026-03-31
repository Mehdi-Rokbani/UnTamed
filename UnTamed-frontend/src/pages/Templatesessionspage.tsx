import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import type {
  ActivitySessionResponse,
  ActivityStatus,
  ActivityTemplateResponse,
} from "../types/activity";
import {
  getTemplateById,
  listMySessions,
  createSession,
  setSessionStatus,
  updateSession,
} from "../api/activity.api";
import styles from "../style/templateSessions.module.css";
import type { Participant } from "../types/guide";
import {
  getSessionBookings,
  cancelPendingBookingByGuide,
} from "../api/guide.api";

type Modal = null | "add";

const STATUS_ORDER: ActivityStatus[] = ["DRAFT", "PUBLISHED", "CANCELLED"];

function statusColor(s: ActivityStatus) {
  if (s === "PUBLISHED") return "published";
  if (s === "CANCELLED") return "cancelled";
  return "draft";
}

function formatDate(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function spotsLeft(s: ActivitySessionResponse) {
  return Math.max(0, s.capacity - s.bookedCount);
}

// ── Accordion section for participants modal ──
function ParticipantAccordion({
  label,
  count,
  accentCls,
  defaultOpen = false,
  children,
}: {
  label: string;
  count: number;
  accentCls: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  if (count === 0) return null;
  return (
    <div className={`${styles.accordion} ${open ? styles.accordionOpen : ""}`}>
      <button
        type="button"
        className={styles.accordionHeader}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <div className={styles.accordionLeft}>
          <span className={`${styles.accordionDot} ${styles[accentCls]}`} />
          <span className={styles.accordionLabel}>{label}</span>
          <span className={`${styles.accordionCount} ${styles[accentCls + "Count"]}`}>
            {count}
          </span>
        </div>
        <span className={`${styles.accordionChevron} ${open ? styles.accordionChevronOpen : ""}`}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </span>
      </button>
      {open && (
        <ul className={styles.participantsList}>
          {children}
        </ul>
      )}
    </div>
  );
}

export default function TemplateSessionsPage() {
  const { id } = useParams<{ id: string }>();
  const nav = useNavigate();

  const [template, setTemplate] = useState<ActivityTemplateResponse | null>(null);
  const [sessions, setSessions] = useState<ActivitySessionResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const [modal, setModal] = useState<Modal>(null);
  const [newDate, setNewDate] = useState("");
  const [newCapacity, setNewCapacity] = useState(10);
  const [adding, setAdding] = useState(false);

  const [participantsModal, setParticipantsModal] = useState<string | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [loadingParticipants, setLoadingParticipants] = useState(false);

  const [cancellingBookingId, setCancellingBookingId] = useState<string | null>(null);
  const [changingId, setChangingId] = useState<string | null>(null);

  async function loadParticipants(sessionId: string) {
    setLoadingParticipants(true);
    setErr(null);
    try {
      const data = await getSessionBookings(sessionId);
      setParticipants(data);
      setParticipantsModal(sessionId);
    } catch (e) {
      setErr("Failed to load bookings");
    } finally {
      setLoadingParticipants(false);
    }
  }

  async function handleGuideCancelPending(bookingId: string) {
    setCancellingBookingId(bookingId);
    setErr(null);
    try {
      await cancelPendingBookingByGuide(bookingId);
      setParticipants((prev) =>
        prev.map((p) =>
          p.bookingId === bookingId
            ? { ...p, status: "CANCELLED", numberOfPeople: 0 }
            : p
        )
      );
      await load();
      showToast("Pending booking cancelled");
    } catch (e) {
      setErr("Failed to cancel pending booking");
    } finally {
      setCancellingBookingId(null);
    }
  }

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }

  async function load() {
    if (!id) return;
    setLoading(true);
    setErr(null);
    try {
      const [tmpl, allSessions] = await Promise.all([
        getTemplateById(id),
        listMySessions(),
      ]);
      setTemplate(tmpl);
      setSessions(allSessions.filter((s) => s.templateId === id));
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [id]);

  async function handleStatusChange(session: ActivitySessionResponse, next: ActivityStatus) {
    setChangingId(session.id);
    setErr(null);
    try {
      const updated = await setSessionStatus(session.id, next);
      setSessions((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
      showToast(
        next === "PUBLISHED" ? "Session published ✅"
        : next === "CANCELLED" ? "Session cancelled"
        : "Moved to draft"
      );
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Status change failed");
    } finally {
      setChangingId(null);
    }
  }

  async function handleAddSession() {
    if (!id || !newDate) return;
    setAdding(true);
    setErr(null);
    try {
      const created = await createSession(id, {
        date: new Date(newDate).toISOString(),
        capacity: newCapacity,
      });
      setSessions((prev) => [...prev, created]);
      setModal(null);
      setNewDate("");
      setNewCapacity(10);
      showToast("Session added ✅");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to add session");
    } finally {
      setAdding(false);
    }
  }

  const now = Date.now();
  const sorted = [...sessions].sort((a, b) => {
    const aTime = new Date(a.date).getTime();
    const bTime = new Date(b.date).getTime();
    const aFuture = aTime >= now;
    const bFuture = bTime >= now;
    if (aFuture !== bFuture) return aFuture ? -1 : 1;
    return aTime - bTime;
  });

  const published = sessions.filter((s) => s.status === "PUBLISHED").length;
  const upcoming  = sessions.filter((s) => new Date(s.date).getTime() >= now).length;

  // ── Participant groups ──
  const confirmedBookings = participants.filter((p) => p.status === "COMPLETED");
  const pendingBookings   = participants.filter((p) => p.status === "PENDING");
  const cancelledBookings = participants.filter((p) => p.status === "CANCELLED");
  const expiredBookings   = participants.filter((p) => p.status === "EXPIRED");
  const otherBookings     = participants.filter(
    (p) => !["COMPLETED", "PENDING", "CANCELLED", "EXPIRED"].includes(p.status)
  );

  const totalSeats = participants.reduce((s, p) => s + (p.numberOfPeople ?? 0), 0);

  // ── Single participant row ──
  function renderBookingRow(p: Participant, idx: number, showCancel = false) {
    const initials = (p.username || "?")
      .split(" ")
      .map((w: string) => w[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);

    const busy = cancellingBookingId === p.bookingId;

    return (
      <li key={p.bookingId} className={styles.participantRow} style={{ animationDelay: `${idx * 0.04}s` }}>
        <div className={styles.participantAvatar}>
          {p.profileImageUrl ? (
            <img
              src={p.profileImageUrl}
              alt={p.username || "participant"}
              className={styles.participantAvatarImg}
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).style.display = "none";
                (e.currentTarget.nextSibling as HTMLElement).style.display = "flex";
              }}
            />
          ) : null}
          <span style={{ display: p.profileImageUrl ? "none" : "flex" }}>{initials}</span>
        </div>

        <div className={styles.participantInfo}>
          <span className={styles.participantName}>{p.username || "Unknown user"}</span>
          <span className={styles.participantEmail}>{p.email || "No email"}</span>
        </div>

        <div className={styles.participantMeta}>
          <span className={styles.participantSeats}>
            {p.numberOfPeople} {p.numberOfPeople === 1 ? "seat" : "seats"}
          </span>
          {showCancel && p.status === "PENDING" && (
            <button
              type="button"
              className={styles.cancelPendingBtn}
              disabled={busy}
              onClick={() => handleGuideCancelPending(p.bookingId)}
            >
              {busy ? "Cancelling…" : "Cancel"}
            </button>
          )}
        </div>
      </li>
    );
  }

  if (loading) {
    return (
      <div className={styles.page}>
        <div className={styles.loadingState}>
          <div className={styles.spinner} />
          <span>Loading sessions…</span>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      {/* ── TOAST ── */}
      {toast && <div className={styles.toast}>{toast}</div>}

      {/* ── HEADER ── */}
      <div className={styles.pageHeader}>
        <div className={styles.headerLeft}>
          <button className={styles.backBtn} type="button" onClick={() => nav("/guide/activities")}>
            ← Back
          </button>
          <div>
            <div className={styles.kicker}>Sessions</div>
            <h1 className={styles.pageTitle}>{template?.title ?? "Template"}</h1>
            <p className={styles.pageSub}>Manage dates for this activity. Publish a session to make it bookable.</p>
          </div>
        </div>
        <div className={styles.headerActions}>
          <button className={styles.btnEdit} type="button" onClick={() => nav(`/guide/templates/${id}/edit`)}>
            ✏️ Edit Template
          </button>
          <button className={styles.btnAdd} type="button" onClick={() => setModal("add")}>
            + Add Session
          </button>
        </div>
      </div>

      {/* ── STATS ── */}
      <div className={styles.statsStrip}>
        <div className={styles.statPill}>
          <span className={styles.statNum}>{sessions.length}</span>
          <span className={styles.statLbl}>Total</span>
        </div>
        <div className={styles.statDivider} />
        <div className={styles.statPill}>
          <span className={`${styles.statNum} ${styles.statGreen}`}>{published}</span>
          <span className={styles.statLbl}>Published</span>
        </div>
        <div className={styles.statDivider} />
        <div className={styles.statPill}>
          <span className={styles.statNum}>{upcoming}</span>
          <span className={styles.statLbl}>Upcoming</span>
        </div>
      </div>

      {err && <div className={styles.errBanner}>⚠️ {err}</div>}

      {sessions.length === 0 && !loading && (
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}>📅</div>
          <div className={styles.emptyTitle}>No sessions yet</div>
          <div className={styles.emptySub}>Add your first session to start accepting bookings.</div>
          <button className={styles.btnAdd} type="button" onClick={() => setModal("add")}>+ Add First Session</button>
        </div>
      )}

      {/* ── SESSION LIST ── */}
      {sorted.length > 0 && (
        <div className={styles.sessionList}>
          {sorted.map((session, idx) => {
            const isPast = new Date(session.date).getTime() < now;
            const left = spotsLeft(session);
            const fillPct = Math.round((session.bookedCount / session.capacity) * 100);
            const isChanging = changingId === session.id;

            return (
              <div
                key={session.id}
                className={`${styles.sessionCard} ${isPast ? styles.sessionPast : ""}`}
                style={{ animationDelay: `${idx * 0.04}s` }}
              >
                <div className={styles.sessionLeft}>
                  <div className={styles.sessionDate}>
                    <div className={styles.dateDay}>{new Date(session.date).toLocaleDateString("en-US", { day: "2-digit" })}</div>
                    <div className={styles.dateMonth}>{new Date(session.date).toLocaleDateString("en-US", { month: "short" })}</div>
                    <div className={styles.dateYear}>{new Date(session.date).toLocaleDateString("en-US", { year: "numeric" })}</div>
                  </div>
                  <span className={`${styles.statusBadge} ${styles[statusColor(session.status)]}`}>{session.status}</span>
                  {isPast && <span className={styles.pastBadge}>Past</span>}
                </div>

                <div className={styles.sessionCenter}>
                  <div className={styles.sessionTime}>
                    🕐 {new Date(session.date).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
                  </div>
                  <div className={styles.capacityRow}>
                    <span className={styles.capacityLabel}>{session.bookedCount} / {session.capacity} booked</span>
                    <span className={`${styles.spotsLeft} ${left === 0 ? styles.spotsNone : left <= 3 ? styles.spotsLow : ""}`}>
                      {left === 0 ? "Sold out" : `${left} spots left`}
                    </span>
                  </div>
                  <div className={styles.fillBar}>
                    <div
                      className={styles.fillBarInner}
                      style={{ width: `${fillPct}%`, background: fillPct >= 90 ? "#d4463c" : fillPct >= 60 ? "#f59e0b" : "#4d7c3f" }}
                    />
                  </div>
                </div>

                <div className={styles.sessionActions}>
                  <button className={styles.actionBtn} type="button" onClick={() => loadParticipants(session.id)}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                      <circle cx="9" cy="7" r="4" />
                      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                    </svg>
                    Bookings
                  </button>

                  {session.status === "DRAFT" && !isPast && (
                    <button className={`${styles.actionBtn} ${styles.actionPublish}`} type="button" disabled={isChanging} onClick={() => handleStatusChange(session, "PUBLISHED")}>
                      {isChanging ? "…" : "▶ Publish"}
                    </button>
                  )}
                  {session.status === "PUBLISHED" && (
                    <button className={`${styles.actionBtn} ${styles.actionUnpublish}`} type="button" disabled={isChanging} onClick={() => handleStatusChange(session, "DRAFT")}>
                      {isChanging ? "…" : "⏸ Unpublish"}
                    </button>
                  )}
                  {session.status !== "CANCELLED" && (
                    <button className={`${styles.actionBtn} ${styles.actionCancel}`} type="button" disabled={isChanging} onClick={() => handleStatusChange(session, "CANCELLED")}>
                      {isChanging ? "…" : "✕ Cancel"}
                    </button>
                  )}
                  {session.status === "CANCELLED" && (
                    <button className={`${styles.actionBtn} ${styles.actionRestore}`} type="button" disabled={isChanging} onClick={() => handleStatusChange(session, "DRAFT")}>
                      {isChanging ? "…" : "↩ Restore"}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── ADD SESSION MODAL ── */}
      {modal === "add" && (
        <div className={styles.modalBackdrop} onClick={() => setModal(null)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2 className={styles.modalTitle}>Add New Session</h2>
              <button className={styles.modalClose} type="button" onClick={() => setModal(null)}>✕</button>
            </div>
            <div className={styles.modalBody}>
              <div className={styles.modalField}>
                <label className={styles.modalLabel}>Date & Time</label>
                <input className={styles.modalInput} type="datetime-local" value={newDate} min={new Date().toISOString().slice(0, 16)} onChange={(e) => setNewDate(e.target.value)} />
              </div>
              <div className={styles.modalField}>
                <label className={styles.modalLabel}>Capacity</label>
                <input className={styles.modalInput} type="number" min={3} max={500} value={newCapacity} onChange={(e) => setNewCapacity(Number(e.target.value))} />
                <span className={styles.modalHint}>Minimum 3 participants</span>
              </div>
              <div className={styles.modalNote}>💡 Sessions start as <strong>DRAFT</strong>. Publish them to accept bookings.</div>
            </div>
            <div className={styles.modalFooter}>
              <button className={styles.modalBtnCancel} type="button" onClick={() => setModal(null)}>Cancel</button>
              <button className={styles.modalBtnConfirm} type="button" disabled={!newDate || newCapacity < 3 || adding} onClick={handleAddSession}>
                {adding ? "Adding…" : "Add Session"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── PARTICIPANTS MODAL ── */}
      {participantsModal && (
        <div className={styles.modalBackdrop} onClick={() => setParticipantsModal(null)}>
          <div className={`${styles.modal} ${styles.participantsModal}`} onClick={(e) => e.stopPropagation()}>

            {/* Header */}
            <div className={styles.modalHeader}>
              <div className={styles.participantsHeaderLeft}>
                <span className={styles.participantsIcon}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                  </svg>
                </span>
                <div>
                  <h2 className={styles.modalTitle}>Participants</h2>
                  {!loadingParticipants && (
                    <p className={styles.participantsSubtitle}>
                      {participants.length} {participants.length === 1 ? "booking" : "bookings"} · {totalSeats} total seats
                    </p>
                  )}
                </div>
              </div>
              <button type="button" className={styles.modalClose} onClick={() => setParticipantsModal(null)}>✕</button>
            </div>

            {/* Summary pills — shown when not loading and has data */}
            {!loadingParticipants && participants.length > 0 && (
              <div className={styles.participantsSummary}>
                {confirmedBookings.length > 0 && (
                  <span className={`${styles.summaryPill} ${styles.summaryConfirmed}`}>
                    <span className={styles.summaryDot} />
                    {confirmedBookings.length} confirmed
                  </span>
                )}
                {pendingBookings.length > 0 && (
                  <span className={`${styles.summaryPill} ${styles.summaryPending}`}>
                    <span className={styles.summaryDot} />
                    {pendingBookings.length} pending
                  </span>
                )}
                {cancelledBookings.length > 0 && (
                  <span className={`${styles.summaryPill} ${styles.summaryCancelled}`}>
                    <span className={styles.summaryDot} />
                    {cancelledBookings.length} cancelled
                  </span>
                )}
                {expiredBookings.length > 0 && (
                  <span className={`${styles.summaryPill} ${styles.summaryExpired}`}>
                    <span className={styles.summaryDot} />
                    {expiredBookings.length} expired
                  </span>
                )}
                {otherBookings.length > 0 && (
                  <span className={`${styles.summaryPill} ${styles.summaryOther}`}>
                    <span className={styles.summaryDot} />
                    {otherBookings.length} other
                  </span>
                )}
              </div>
            )}

            {/* Body */}
            <div className={styles.participantsBody}>
              {loadingParticipants ? (
                <div className={styles.participantsSkeleton}>
                  {[1, 2, 3].map((i) => (
                    <div key={i} className={styles.skeletonRow}>
                      <div className={styles.skeletonAvatar} />
                      <div className={styles.skeletonLines}>
                        <div className={styles.skeletonLine} style={{ width: "40%" }} />
                        <div className={styles.skeletonLine} style={{ width: "60%" }} />
                      </div>
                      <div className={styles.skeletonBadge} />
                    </div>
                  ))}
                </div>
              ) : participants.length === 0 ? (
                <div className={styles.participantsEmpty}>
                  <div className={styles.participantsEmptyIcon}>🪑</div>
                  <p className={styles.participantsEmptyTitle}>No bookings yet</p>
                  <p className={styles.participantsEmptyHint}>Participants will appear here once the session is booked.</p>
                </div>
              ) : (
                <div className={styles.accordionList}>

                  {/* CONFIRMED — open by default */}
                  <ParticipantAccordion label="Confirmed" count={confirmedBookings.length} accentCls="accentConfirmed" defaultOpen={true}>
                    {confirmedBookings.map((p, idx) => renderBookingRow(p, idx, false))}
                  </ParticipantAccordion>

                  {/* PENDING — open by default (action required) */}
                  <ParticipantAccordion label="Pending" count={pendingBookings.length} accentCls="accentPending" defaultOpen={true}>
                    {pendingBookings.map((p, idx) => renderBookingRow(p, idx, true))}
                  </ParticipantAccordion>

                  {/* CANCELLED — collapsed by default */}
                  <ParticipantAccordion label="Cancelled" count={cancelledBookings.length} accentCls="accentCancelled" defaultOpen={false}>
                    {cancelledBookings.map((p, idx) => renderBookingRow(p, idx, false))}
                  </ParticipantAccordion>

                  {/* EXPIRED — collapsed by default */}
                  <ParticipantAccordion label="Expired" count={expiredBookings.length} accentCls="accentExpired" defaultOpen={false}>
                    {expiredBookings.map((p, idx) => renderBookingRow(p, idx, false))}
                  </ParticipantAccordion>

                  {/* OTHER — collapsed by default */}
                  <ParticipantAccordion label="Other" count={otherBookings.length} accentCls="accentOther" defaultOpen={false}>
                    {otherBookings.map((p, idx) => renderBookingRow(p, idx, false))}
                  </ParticipantAccordion>

                </div>
              )}
            </div>

            {/* Footer */}
            <div className={styles.participantsFooter}>
              <span className={styles.participantsFooterStat}><strong>{confirmedBookings.length}</strong> confirmed</span>
              <span className={styles.participantsFooterDot} />
              <span className={styles.participantsFooterStat}><strong>{pendingBookings.length}</strong> pending</span>
              <span className={styles.participantsFooterDot} />
              <span className={styles.participantsFooterStat}><strong>{totalSeats}</strong> total seats</span>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
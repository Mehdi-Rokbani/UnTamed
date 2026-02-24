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

export default function TemplateSessionsPage() {
  const { id } = useParams<{ id: string }>(); // templateId
  const nav = useNavigate();

  const [template, setTemplate] = useState<ActivityTemplateResponse | null>(null);
  const [sessions, setSessions] = useState<ActivitySessionResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  // Add session modal state
  const [modal, setModal] = useState<Modal>(null);
  const [newDate, setNewDate] = useState("");
  const [newCapacity, setNewCapacity] = useState(10);
  const [adding, setAdding] = useState(false);

  // Status change in-flight tracking
  const [changingId, setChangingId] = useState<string | null>(null);

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
      // filter sessions belonging to this template
      setSessions(allSessions.filter((s) => s.templateId === id));
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [id]);

  async function handleStatusChange(session: ActivitySessionResponse, next: ActivityStatus) {
    setChangingId(session.id);
    setErr(null);
    try {
      const updated = await setSessionStatus(session.id, next);
      setSessions((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
      showToast(`Session ${next === "PUBLISHED" ? "published ✅" : next === "CANCELLED" ? "cancelled" : "moved to draft"}`);
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

  // Sort: upcoming first, then past; within each group by date asc
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
  const upcoming = sessions.filter((s) => new Date(s.date).getTime() >= now).length;

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
            <p className={styles.pageSub}>
              Manage dates for this activity. Publish a session to make it bookable.
            </p>
          </div>
        </div>

        <div className={styles.headerActions}>
          <button
            className={styles.btnEdit}
            type="button"
            onClick={() => nav(`/guide/templates/${id}/edit`)}
          >
            ✏️ Edit Template
          </button>
          <button
            className={styles.btnAdd}
            type="button"
            onClick={() => setModal("add")}
          >
            + Add Session
          </button>
        </div>
      </div>

      {/* ── STATS STRIP ── */}
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

      {/* ── ERROR ── */}
      {err && <div className={styles.errBanner}>⚠️ {err}</div>}

      {/* ── EMPTY ── */}
      {sessions.length === 0 && !loading && (
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}>📅</div>
          <div className={styles.emptyTitle}>No sessions yet</div>
          <div className={styles.emptySub}>
            Add your first session to start accepting bookings.
          </div>
          <button className={styles.btnAdd} type="button" onClick={() => setModal("add")}>
            + Add First Session
          </button>
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
                {/* Left: date + status */}
                <div className={styles.sessionLeft}>
                  <div className={styles.sessionDate}>
                    <div className={styles.dateDay}>
                      {new Date(session.date).toLocaleDateString("en-US", { day: "2-digit" })}
                    </div>
                    <div className={styles.dateMonth}>
                      {new Date(session.date).toLocaleDateString("en-US", { month: "short" })}
                    </div>
                    <div className={styles.dateYear}>
                      {new Date(session.date).toLocaleDateString("en-US", { year: "numeric" })}
                    </div>
                  </div>

                  <span className={`${styles.statusBadge} ${styles[statusColor(session.status)]}`}>
                    {session.status}
                  </span>

                  {isPast && <span className={styles.pastBadge}>Past</span>}
                </div>

                {/* Center: time + capacity fill */}
                <div className={styles.sessionCenter}>
                  <div className={styles.sessionTime}>
                    🕐 {new Date(session.date).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
                  </div>

                  <div className={styles.capacityRow}>
                    <span className={styles.capacityLabel}>
                      {session.bookedCount} / {session.capacity} booked
                    </span>
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

                {/* Right: action buttons */}
                <div className={styles.sessionActions}>
                  {/* Status transitions */}
                  {session.status === "DRAFT" && !isPast && (
                    <button
                      className={`${styles.actionBtn} ${styles.actionPublish}`}
                      type="button"
                      disabled={isChanging}
                      onClick={() => handleStatusChange(session, "PUBLISHED")}
                    >
                      {isChanging ? "…" : "▶ Publish"}
                    </button>
                  )}

                  {session.status === "PUBLISHED" && (
                    <button
                      className={`${styles.actionBtn} ${styles.actionUnpublish}`}
                      type="button"
                      disabled={isChanging}
                      onClick={() => handleStatusChange(session, "DRAFT")}
                    >
                      {isChanging ? "…" : "⏸ Unpublish"}
                    </button>
                  )}

                  {session.status !== "CANCELLED" && (
                    <button
                      className={`${styles.actionBtn} ${styles.actionCancel}`}
                      type="button"
                      disabled={isChanging}
                      onClick={() => handleStatusChange(session, "CANCELLED")}
                    >
                      {isChanging ? "…" : "✕ Cancel"}
                    </button>
                  )}

                  {session.status === "CANCELLED" && (
                    <button
                      className={`${styles.actionBtn} ${styles.actionRestore}`}
                      type="button"
                      disabled={isChanging}
                      onClick={() => handleStatusChange(session, "DRAFT")}
                    >
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
              <button className={styles.modalClose} type="button" onClick={() => setModal(null)}>
                ✕
              </button>
            </div>

            <div className={styles.modalBody}>
              <div className={styles.modalField}>
                <label className={styles.modalLabel}>Date & Time</label>
                <input
                  className={styles.modalInput}
                  type="datetime-local"
                  value={newDate}
                  min={new Date().toISOString().slice(0, 16)}
                  onChange={(e) => setNewDate(e.target.value)}
                />
              </div>

              <div className={styles.modalField}>
                <label className={styles.modalLabel}>Capacity</label>
                <input
                  className={styles.modalInput}
                  type="number"
                  min={3}
                  max={500}
                  value={newCapacity}
                  onChange={(e) => setNewCapacity(Number(e.target.value))}
                />
                <span className={styles.modalHint}>Minimum 3 participants</span>
              </div>

              <div className={styles.modalNote}>
                💡 Sessions start as <strong>DRAFT</strong>. You'll need to publish them to accept bookings.
              </div>
            </div>

            <div className={styles.modalFooter}>
              <button className={styles.modalBtnCancel} type="button" onClick={() => setModal(null)}>
                Cancel
              </button>
              <button
                className={styles.modalBtnConfirm}
                type="button"
                disabled={!newDate || newCapacity < 3 || adding}
                onClick={handleAddSession}
              >
                {adding ? "Adding…" : "Add Session"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
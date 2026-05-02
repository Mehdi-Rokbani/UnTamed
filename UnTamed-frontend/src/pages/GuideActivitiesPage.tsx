import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import type {
  ActivityTemplateResponse,
  ActivitySessionResponse,
} from "../types/activity";
import {
  listMyTemplates,
  listMySessions,
  archiveTemplate,
  deleteTemplate,
} from "../api/activity.api";
import styles from "../style/guideActivities.module.css";

// ─── helpers ────────────────────────────────────────────────────────────────

function coverUrl(t: ActivityTemplateResponse) {
  return (t.images ?? []).find((i) => i.cover)?.url ?? null;
}

function difficultyConfig(d: string): { label: string; color: string; bg: string } {
  if (d === "HARD") {
    return { label: "Hard", color: "#dc2626", bg: "rgba(220,38,38,0.15)" };
  }

  if (d === "MEDIUM") {
    return { label: "Medium", color: "#d97706", bg: "rgba(217,119,6,0.15)" };
  }

  return { label: "Easy", color: "#16a34a", bg: "rgba(22,163,74,0.15)" };
}

function formatDateShort(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";

  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function getApiErrorMessage(e: unknown) {
  if (typeof e === "object" && e !== null && "response" in e) {
    const err = e as { response?: { data?: { message?: string } } };
    return err.response?.data?.message ?? "Request failed";
  }

  return e instanceof Error ? e.message : "Request failed";
}

function humanError(raw: string): string {
  if (/409|upcoming sessions|active.*booking|confirmed.*booking/i.test(raw)) {
    return "This activity can't be archived or deleted right now because it has upcoming sessions with confirmed bookings. Cancel those sessions first, then try again.";
  }

  if (/future.*session|booked session/i.test(raw)) {
    return "This activity has future booked sessions and can't be deleted. Remove or cancel those sessions first.";
  }

  return raw;
}

// ─── toast ──────────────────────────────────────────────────────────────────

type Toast = {
  id: number;
  type: "success" | "error" | "warn";
  message: string;
};

let toastId = 0;

// ─── modal types ────────────────────────────────────────────────────────────

type ModalState =
  | { kind: "idle" }
  | { kind: "archive-blocked"; title: string }
  | { kind: "archive-confirm"; templateId: string; title: string }
  | { kind: "delete-confirm"; templateId: string; title: string };

// ─── component ──────────────────────────────────────────────────────────────

export default function GuideActivitiesPage() {
  const nav = useNavigate();

  const [templates, setTemplates] = useState<ActivityTemplateResponse[]>([]);
  const [sessions, setSessions] = useState<ActivitySessionResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [tab, setTab] = useState<"active" | "archived">("active");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [modal, setModal] = useState<ModalState>({ kind: "idle" });
  const [toasts, setToasts] = useState<Toast[]>([]);

  function addToast(type: Toast["type"], message: string) {
    const id = ++toastId;

    setToasts((prev) => [...prev, { id, type, message }]);

    window.setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4500);
  }

  async function refresh() {
    setLoading(true);

    try {
      const [tmpl, sess] = await Promise.all([
        listMyTemplates(),
        listMySessions(),
      ]);

      setTemplates(tmpl ?? []);
      setSessions(sess ?? []);
    } catch (e) {
      addToast("error", getApiErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  useEffect(() => {
    const previousBackground = document.body.style.background;
    document.body.style.background = "#ffffff";

    return () => {
      document.body.style.background = previousBackground;
    };
  }, []);

  const sessionMap = useMemo(() => {
    const map = new Map<
      string,
      {
        total: number;
        published: number;
        upcoming: number;
        nextDate: string | null;
        hasActiveBookings: boolean;
        bookedCount: number;
      }
    >();

    const now = Date.now();

    for (const s of sessions) {
      const prev = map.get(s.templateId) ?? {
        total: 0,
        published: 0,
        upcoming: 0,
        nextDate: null,
        hasActiveBookings: false,
        bookedCount: 0,
      };

      const startTime = new Date(s.startAt).getTime();
      const isUpcoming = startTime >= now;
      const isPublished = s.status === "PUBLISHED";
      const currentBookedCount = s.bookedCount ?? 0;
      const hasBookings = currentBookedCount > 0;

      map.set(s.templateId, {
        total: prev.total + 1,
        published: prev.published + (isPublished ? 1 : 0),
        upcoming: prev.upcoming + (isUpcoming ? 1 : 0),
        bookedCount: prev.bookedCount + currentBookedCount,
        hasActiveBookings: prev.hasActiveBookings || (isUpcoming && hasBookings),
        nextDate:
          isUpcoming && isPublished
            ? !prev.nextDate || new Date(s.startAt) < new Date(prev.nextDate)
              ? s.startAt
              : prev.nextDate
            : prev.nextDate,
      });
    }

    return map;
  }, [sessions]);

  const activeTemplates = useMemo(
    () => templates.filter((t) => !t.archived),
    [templates]
  );

  const archivedTemplates = useMemo(
    () => templates.filter((t) => t.archived),
    [templates]
  );

  const visibleTemplates = tab === "active" ? activeTemplates : archivedTemplates;

  const filtered = useMemo(() => {
    const text = q.trim().toLowerCase();

    return visibleTemplates
      .filter((t) => {
        if (!text) return true;

        return `${t.title ?? ""} ${t.description ?? ""}`
          .toLowerCase()
          .includes(text);
      })
      .sort((a, b) =>
        (b.updatedAt ?? b.createdAt ?? "").localeCompare(
          a.updatedAt ?? a.createdAt ?? ""
        )
      );
  }, [visibleTemplates, q]);

  const totalUpcoming = sessions.filter(
    (s) => new Date(s.startAt).getTime() >= Date.now()
  ).length;

  function requestArchive(templateId: string, title: string) {
    const sess = sessionMap.get(templateId);

    if (sess?.hasActiveBookings) {
      setModal({ kind: "archive-blocked", title });
      return;
    }

    setModal({ kind: "archive-confirm", templateId, title });
  }

  function requestDelete(templateId: string, title: string) {
    setModal({ kind: "delete-confirm", templateId, title });
  }

  async function confirmArchive(templateId: string) {
    setModal({ kind: "idle" });
    setBusyId(templateId);

    try {
      const res = await archiveTemplate(templateId);
      await refresh();
      addToast("success", res.message || "Activity archived successfully.");
    } catch (e) {
      addToast("error", humanError(getApiErrorMessage(e)));
    } finally {
      setBusyId(null);
    }
  }

  async function confirmDelete(templateId: string) {
    setModal({ kind: "idle" });
    setBusyId(templateId);

    try {
      const res = await deleteTemplate(templateId);
      await refresh();
      addToast("success", res.message || "Activity deleted successfully.");
    } catch (e) {
      addToast("error", humanError(getApiErrorMessage(e)));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div
      className={styles.shell}
      style={{ minHeight: "100vh", backgroundColor: "#ffffff" }}
    >
      {/* TOP BAR */}
      <div className={styles.topBar}>
        <div>
          <h1 className={styles.pageTitle}>My Activities</h1>
          <p className={styles.pageSub}>
            {activeTemplates.length} active · {archivedTemplates.length} archived ·{" "}
            {sessions.length} session{sessions.length !== 1 ? "s" : ""}
          </p>
        </div>

        <div className={styles.topBarActions}>
          <button
            className={styles.btnRefresh}
            type="button"
            onClick={refresh}
            title="Refresh"
          >
            <svg
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
            >
              <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
              <path d="M3 3v5h5" />
            </svg>
            Refresh
          </button>

          <button
            className={styles.btnCreate}
            type="button"
            onClick={() => nav("/activities/create")}
          >
            + New Activity
          </button>
        </div>
      </div>

      {/* STATS */}
      <div className={styles.statsRow}>
        {[
          { value: activeTemplates.length, label: "Active", accent: true },
          { value: archivedTemplates.length, label: "Archived", accent: false },
          { value: sessions.length, label: "Sessions", accent: false },
          { value: totalUpcoming, label: "Upcoming", accent: false },
        ].map(({ value, label, accent }) => (
          <div key={label} className={styles.statCard}>
            <span
              className={`${styles.statValue} ${
                accent ? styles.statValueAccent : ""
              }`}
            >
              {value}
            </span>
            <span className={styles.statLabel}>{label}</span>
          </div>
        ))}
      </div>

      {/* TABS */}
      <div className={styles.tabs}>
        <button
          type="button"
          className={`${styles.tab} ${tab === "active" ? styles.tabActive : ""}`}
          onClick={() => setTab("active")}
        >
          Active
          <span
            className={`${styles.tabCount} ${
              tab === "active" ? styles.tabCountActive : ""
            }`}
          >
            {activeTemplates.length}
          </span>
        </button>

        <button
          type="button"
          className={`${styles.tab} ${
            tab === "archived" ? styles.tabActive : ""
          }`}
          onClick={() => setTab("archived")}
        >
          Archived
          <span
            className={`${styles.tabCount} ${
              tab === "archived" ? styles.tabCountActive : ""
            }`}
          >
            {archivedTemplates.length}
          </span>
        </button>
      </div>

      {/* SEARCH */}
      <div className={styles.searchBar}>
        <div className={styles.searchField}>
          <svg
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#9ca3af"
            strokeWidth="2"
          >
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.35-4.35" />
          </svg>

          <input
            className={styles.searchInput}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search activities…"
          />

          {q && (
            <button
              className={styles.clearBtn}
              type="button"
              onClick={() => setQ("")}
            >
              ✕
            </button>
          )}
        </div>

        {q && (
          <span className={styles.resultHint}>
            {filtered.length} result{filtered.length !== 1 ? "s" : ""}
          </span>
        )}
      </div>

      {/* LOADING */}
      {loading && (
        <div className={styles.loadingState}>
          <div className={styles.spinner} />
          Loading your activities…
        </div>
      )}

      {/* EMPTY */}
      {!loading && filtered.length === 0 && (
        <div className={styles.emptyState}>
          <svg
            width="48"
            height="48"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#d1d5db"
            strokeWidth="1.2"
          >
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <circle cx="8.5" cy="8.5" r="1.5" />
            <polyline points="21 15 16 10 5 21" />
          </svg>

          <p className={styles.emptyTitle}>
            {q
              ? "No matches found"
              : tab === "archived"
                ? "No archived activities"
                : "No activities yet"}
          </p>

          <p className={styles.emptySub}>
            {q
              ? `Nothing matches "${q}"`
              : tab === "archived"
                ? "Activities you archive will appear here."
                : "Create your first activity to start accepting bookings."}
          </p>

          {!q && tab === "active" && (
            <button
              className={styles.btnCreate}
              type="button"
              onClick={() => nav("/activities/create")}
            >
              + New Activity
            </button>
          )}
        </div>
      )}

      {/* GRID */}
      {!loading && filtered.length > 0 && (
        <div className={styles.grid}>
          {filtered.map((t, i) => {
            const cover = coverUrl(t);
            const sess = sessionMap.get(t.id);
            const diff = difficultyConfig(t.difficulty);
            const isFree = Number(t.price ?? 0) === 0;
            const isBlockedArchive = !t.archived && !!sess?.hasActiveBookings;
            const isBusy = busyId === t.id;

            return (
              <article
                key={t.id}
                className={`${styles.card} ${isBusy ? styles.cardBusy : ""}`}
                style={{ animationDelay: `${i * 0.04}s` }}
              >
                {/* IMAGE */}
                <div
                  className={styles.cardImage}
                  style={
                    cover
                      ? {
                          backgroundImage: `url(${cover})`,
                          backgroundSize: "cover",
                          backgroundPosition: "center",
                        }
                      : undefined
                  }
                >
                  {!cover && (
                    <div className={styles.imgFallback}>
                      <svg
                        width="28"
                        height="28"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="#c4c9d1"
                        strokeWidth="1.3"
                      >
                        <rect x="3" y="3" width="18" height="18" rx="2" />
                        <circle cx="8.5" cy="8.5" r="1.5" />
                        <polyline points="21 15 16 10 5 21" />
                      </svg>
                    </div>
                  )}

                  <div className={styles.imgScrim} />

                  <span
                    className={styles.diffTag}
                    style={{ color: diff.color, background: diff.bg }}
                  >
                    {diff.label}
                  </span>

                  <span className={styles.priceTag}>
                    {isFree ? "Free" : `${t.price} TND`}
                  </span>

                  {isBlockedArchive && (
                    <span className={styles.bookingsBadge}>
                      <svg
                        width="10"
                        height="10"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                      >
                        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                      </svg>
                      Active bookings
                    </span>
                  )}
                </div>

                {/* CONTENT */}
                <div className={styles.cardContent}>
                  {t.archived && (
                    <span className={`${styles.chip} ${styles.chipGray}`}>
                      Archived
                    </span>
                  )}

                  <h3 className={styles.cardTitle}>{t.title}</h3>

                  <div className={styles.sessionInfo}>
                    {sess ? (
                      <>
                        <span className={styles.chip}>
                          📅 {sess.total} session{sess.total !== 1 ? "s" : ""}
                        </span>

                        {sess.published > 0 ? (
                          <span className={`${styles.chip} ${styles.chipGreen}`}>
                            ✓ {sess.published} live
                          </span>
                        ) : (
                          <span className={`${styles.chip} ${styles.chipGray}`}>
                            Not published
                          </span>
                        )}

                        {sess.bookedCount > 0 && (
                          <span className={`${styles.chip} ${styles.chipOrange}`}>
                            👥 {sess.bookedCount} booked
                          </span>
                        )}

                        {sess.nextDate && (
                          <span className={`${styles.chip} ${styles.chipOrange}`}>
                            Next {formatDateShort(sess.nextDate)}
                          </span>
                        )}
                      </>
                    ) : (
                      <span className={`${styles.chip} ${styles.chipWarn}`}>
                        Add a session to publish
                      </span>
                    )}
                  </div>
                </div>

                {/* ACTIONS */}
                <div className={styles.cardActions}>
                  {!t.archived && (
                    <button
                      type="button"
                      className={styles.actionEdit}
                      onClick={() => nav(`/guide/templates/${t.id}/edit`)}
                      disabled={isBusy}
                    >
                      Edit
                    </button>
                  )}

                  <button
                    type="button"
                    className={styles.actionSessions}
                    onClick={() => nav(`/guide/templates/${t.id}/sessions`)}
                    disabled={isBusy}
                  >
                    Sessions
                    {sess && sess.total > 0 && (
                      <span className={styles.sessCount}>{sess.total}</span>
                    )}
                  </button>

                  {!t.archived && (
                    <div className={styles.archiveWrapper}>
                      <button
                        type="button"
                        className={`${styles.actionArchive} ${
                          isBlockedArchive ? styles.actionArchiveBlocked : ""
                        }`}
                        onClick={() =>
                          requestArchive(t.id, t.title ?? "this activity")
                        }
                        disabled={isBusy}
                        aria-describedby={
                          isBlockedArchive ? `archive-tip-${t.id}` : undefined
                        }
                      >
                        {isBusy ? (
                          <>
                            <span className={styles.btnSpinner} /> Working…
                          </>
                        ) : (
                          "Archive"
                        )}
                      </button>

                      {isBlockedArchive && (
                        <span
                          className={styles.archiveTip}
                          id={`archive-tip-${t.id}`}
                          role="tooltip"
                        >
                          Cancel upcoming sessions with bookings first
                        </span>
                      )}
                    </div>
                  )}

                  <button
                    type="button"
                    className={styles.actionDelete}
                    onClick={() =>
                      requestDelete(t.id, t.title ?? "this activity")
                    }
                    disabled={isBusy}
                  >
                    {isBusy ? (
                      <>
                        <span className={styles.btnSpinner} /> Working…
                      </>
                    ) : (
                      "Delete"
                    )}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* MODALS */}
      {modal.kind !== "idle" && (
        <div
          className={styles.overlay}
          onClick={() => setModal({ kind: "idle" })}
          aria-modal="true"
          role="dialog"
        >
          <div className={styles.modalBox} onClick={(e) => e.stopPropagation()}>
            {modal.kind === "archive-blocked" && (
              <>
                <div className={`${styles.modalIcon} ${styles.modalIconWarn}`}>
                  <svg
                    width="22"
                    height="22"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                    <line x1="12" y1="9" x2="12" y2="13" />
                    <line x1="12" y1="17" x2="12.01" y2="17" />
                  </svg>
                </div>

                <h2 className={styles.modalTitle}>Cannot archive right now</h2>

                <p className={styles.modalBody}>
                  <strong>{modal.title}</strong> has upcoming sessions with
                  bookings. To archive this activity, cancel those sessions
                  first.
                </p>

                <div className={styles.modalActions}>
                  <button
                    className={styles.modalBtnPrimary}
                    type="button"
                    onClick={() => setModal({ kind: "idle" })}
                  >
                    Got it
                  </button>
                </div>
              </>
            )}

            {modal.kind === "archive-confirm" && (
              <>
                <div className={`${styles.modalIcon} ${styles.modalIconNeutral}`}>
                  <svg
                    width="22"
                    height="22"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <polyline points="21 8 21 21 3 21 3 8" />
                    <rect x="1" y="3" width="22" height="5" />
                    <line x1="10" y1="12" x2="14" y2="12" />
                  </svg>
                </div>

                <h2 className={styles.modalTitle}>Archive activity?</h2>

                <p className={styles.modalBody}>
                  <strong>{modal.title}</strong> will be hidden from public
                  discovery. Your session history and stats will remain
                  available in your dashboard.
                </p>

                <div className={styles.modalActions}>
                  <button
                    className={styles.modalBtnGhost}
                    type="button"
                    onClick={() => setModal({ kind: "idle" })}
                  >
                    Cancel
                  </button>

                  <button
                    className={styles.modalBtnPrimary}
                    type="button"
                    onClick={() => confirmArchive(modal.templateId)}
                  >
                    Archive activity
                  </button>
                </div>
              </>
            )}

            {modal.kind === "delete-confirm" && (
              <>
                <div className={`${styles.modalIcon} ${styles.modalIconDanger}`}>
                  <svg
                    width="22"
                    height="22"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6l-1 14H6L5 6" />
                    <path d="M10 11v6" />
                    <path d="M14 11v6" />
                    <path d="M9 6V4h6v2" />
                  </svg>
                </div>

                <h2 className={styles.modalTitle}>Delete permanently?</h2>

                <p className={styles.modalBody}>
                  This will permanently remove <strong>{modal.title}</strong>.
                  Activities with upcoming booked sessions cannot be deleted.
                  <span className={styles.modalWarnNote}>
                    This action cannot be undone.
                  </span>
                </p>

                <div className={styles.modalActions}>
                  <button
                    className={styles.modalBtnGhost}
                    type="button"
                    onClick={() => setModal({ kind: "idle" })}
                  >
                    Cancel
                  </button>

                  <button
                    className={styles.modalBtnDanger}
                    type="button"
                    onClick={() => confirmDelete(modal.templateId)}
                  >
                    Delete activity
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* TOASTS */}
      <div className={styles.toastStack} aria-live="polite">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`${styles.toast} ${styles[`toast_${t.type}`]}`}
          >
            {t.type === "success" && (
              <svg
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
              >
                <polyline points="20 6 9 17 4 12" />
              </svg>
            )}

            {t.type === "error" && (
              <svg
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
              >
                <circle cx="12" cy="12" r="10" />
                <line x1="15" y1="9" x2="9" y2="15" />
                <line x1="9" y1="9" x2="15" y2="15" />
              </svg>
            )}

            {t.type === "warn" && (
              <svg
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
              >
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
            )}

            <span>{t.message}</span>

            <button
              className={styles.toastClose}
              type="button"
              onClick={() =>
                setToasts((prev) => prev.filter((x) => x.id !== t.id))
              }
            >
              ✕
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
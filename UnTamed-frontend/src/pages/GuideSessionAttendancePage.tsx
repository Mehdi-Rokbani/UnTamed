import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import * as GuestPassApi from "../api/guestPass.api";
import type { GuideGuestPassAttendance } from "../api/guestPass.api";
import { BackButton } from "../components/BackButton";
import { OpenSessionChatButton } from "../components/OpenSessionChatButton";
import styles from "../style/guide-attendance.module.css";

function formatDateTime(iso?: string | null): string {
  if (!iso) return "Date unavailable";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error || "");
  if (/HTTP 401/i.test(message)) return "Guide login required.";
  if (/HTTP 403/i.test(message)) return "Only the guide who owns this session can view attendance.";
  if (/HTTP 404/i.test(message)) return "Session not found.";
  return message || "Could not load attendance.";
}

function statusClass(status: string) {
  return `${styles.badge} ${styles[`badge${status}`] ?? ""}`;
}

function attendanceLabel(status: string): string {
  if (status === "NOT_MARKED") return "Not checked in";
  return status.replace("_", " ");
}

function sessionState(rows: GuideGuestPassAttendance[]): "UPCOMING" | "PAST" | "CANCELLED" {
  if (rows.length > 0 && rows.every((row) => row.status === "CANCELLED")) return "CANCELLED";
  const startAt = rows[0]?.sessionStartAt;
  const start = startAt ? new Date(startAt).getTime() : Number.NaN;
  if (!Number.isNaN(start) && start > Date.now()) return "UPCOMING";
  return "PAST";
}

export default function GuideSessionAttendancePage() {
  const { sessionId } = useParams();
  const [rows, setRows] = useState<GuideGuestPassAttendance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!sessionId) {
      setError("Missing session id.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");
    try {
      setRows(await GuestPassApi.getGuideSessionAttendance(sessionId));
    } catch (err) {
      setError(formatError(err));
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    void load();
  }, [load]);

  const summary = useMemo(() => {
    const present = rows.filter((row) => row.attendanceStatus === "PRESENT").length;
    const absent = rows.filter((row) => row.attendanceStatus === "ABSENT").length;
    const notMarked = rows.filter((row) => row.attendanceStatus === "NOT_MARKED").length;
    const cancelled = rows.filter((row) => row.status === "CANCELLED").length;
    return { total: rows.length, present, absent, notMarked, cancelled };
  }, [rows]);

  const first = rows[0];
  const state = sessionState(rows);

  return (
    <section className={styles.page}>
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>Session attendance</p>
          <h1 className={styles.title}>{first?.activityTitle ?? "Attendance"}</h1>
          <p className={styles.subtitle}>
            {first
              ? formatDateTime(first.sessionStartAt)
              : "Review guest pass attendance for this session."}
          </p>
        </div>
        <div className={styles.headerActions}>
          <BackButton
            fallbackTo="/guide/attendance-history"
            label="Back to history"
            className={styles.actionLink}
            variant="plain"
          />
          <OpenSessionChatButton
            sessionId={sessionId}
            className={styles.refreshBtn}
            label="Open chat"
          />
          <button className={styles.refreshBtn} type="button" onClick={load}>
            Refresh
          </button>
        </div>
      </header>

      <div className={styles.sessionHero}>
        <div>
          <span className={statusClass(state)}>
            {state === "PAST" ? "Completed" : state === "CANCELLED" ? "Cancelled" : "Upcoming"}
          </span>
          <h2>{first?.activityTitle ?? "Session attendance"}</h2>
          <p>{first ? formatDateTime(first.sessionStartAt) : "Session details will appear once attendance loads."}</p>
        </div>
        <div className={styles.sessionHeroMetric}>
          <strong>{summary.present}</strong>
          <span>present of {summary.total}</span>
        </div>
      </div>

      <div className={styles.statsGrid} aria-label="Session attendance summary">
        <div className={styles.statCard}>
          <span>Total passes</span>
          <strong>{summary.total}</strong>
        </div>
        <div className={styles.statCard}>
          <span>Present</span>
          <strong>{summary.present}</strong>
        </div>
        <div className={styles.statCard}>
          <span>Absent</span>
          <strong>{summary.absent}</strong>
        </div>
        <div className={styles.statCard}>
          <span>Not checked in</span>
          <strong>{summary.notMarked}</strong>
        </div>
      </div>

      {loading && (
        <div className={styles.skeletonList} aria-label="Loading session attendance">
          {Array.from({ length: 5 }).map((_, index) => (
            <div className={styles.skeletonRow} key={index}>
              <span />
              <div>
                <i />
                <b />
              </div>
              <em />
            </div>
          ))}
        </div>
      )}

      {!loading && error && (
        <div className={`${styles.stateCard} ${styles.error}`}>
          <h2>Could not load this session</h2>
          <p>{error}</p>
          <button className={styles.refreshBtn} type="button" onClick={load}>
            Try again
          </button>
        </div>
      )}

      {!loading && !error && rows.length === 0 && (
        <div className={styles.emptyState}>
          <div className={styles.emptyIllustration} aria-hidden="true">UT</div>
          <h2>No attendance records yet</h2>
          <p>Guest passes for this session will appear here after completed bookings generate passes.</p>
          <Link className={styles.actionLink} to="/guide/attendance-history">
            Back to history
          </Link>
        </div>
      )}

      {!loading && !error && rows.length > 0 && (
        <section className={styles.attendancePanel}>
          <div className={styles.panelHeader}>
            <div>
              <h2>Participants</h2>
              <p>
                {summary.present} present, {summary.absent} absent, {summary.notMarked} not checked in
                {summary.cancelled > 0 ? `, ${summary.cancelled} cancelled` : ""}
              </p>
            </div>
            <span>{rows.length} passes</span>
          </div>

          <div className={styles.sessionList}>
            {rows.map((row) => (
              <article className={styles.participantRow} key={row.id}>
                <div className={styles.participantAvatar} aria-hidden="true">
                  {row.guestName.slice(0, 2).toUpperCase()}
                </div>
                <div className={styles.participantMain}>
                  <h3>{row.guestName}</h3>
                  <div className={styles.rowMeta}>
                    <span>{row.mainBooker ? "Main booker" : "Guest"}</span>
                    <span>Pass {row.passNumber} of {row.totalPasses}</span>
                    {row.markedAt && <span>Marked {formatDateTime(row.markedAt)}</span>}
                    {row.markedByGuideId && <span>Guide #{row.markedByGuideId.slice(0, 8)}</span>}
                  </div>
                </div>
                <div className={styles.participantStatus}>
                  <span className={statusClass(row.status === "CANCELLED" ? "CANCELLED" : row.attendanceStatus)}>
                    {row.status === "CANCELLED" ? "Cancelled" : attendanceLabel(row.attendanceStatus)}
                  </span>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}
    </section>
  );
}

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import * as GuestPassApi from "../api/guestPass.api";
import type { GuideGuestPassAttendance } from "../api/guestPass.api";
import styles from "../style/guide-attendance.module.css";

function formatDateTime(iso?: string | null): string {
  if (!iso) return "Date unavailable";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
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

  useEffect(() => { void load(); }, [load]);

  const summary = useMemo(() => {
    const present = rows.filter((row) => row.attendanceStatus === "PRESENT").length;
    const absent = rows.filter((row) => row.attendanceStatus === "ABSENT").length;
    const notMarked = rows.filter((row) => row.attendanceStatus === "NOT_MARKED").length;
    return { total: rows.length, present, absent, notMarked };
  }, [rows]);

  const first = rows[0];

  return (
    <section className={styles.page}>
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>Session attendance</p>
          <h1 className={styles.title}>{first?.activityTitle ?? "Attendance"}</h1>
          <p className={styles.subtitle}>{first ? formatDateTime(first.sessionStartAt) : "Review guest pass attendance for this session."}</p>
        </div>
        <button className={styles.refreshBtn} type="button" onClick={load}>Refresh</button>
      </header>

      <div className={styles.summaryGrid}>
        <div className={styles.summaryCard}><span>Total passes</span><strong>{summary.total}</strong></div>
        <div className={styles.summaryCard}><span>Present</span><strong>{summary.present}</strong></div>
        <div className={styles.summaryCard}><span>Absent</span><strong>{summary.absent}</strong></div>
        <div className={styles.summaryCard}><span>Not marked</span><strong>{summary.notMarked}</strong></div>
      </div>

      {loading && <div className={styles.stateCard}>Loading attendance...</div>}
      {!loading && error && <div className={`${styles.stateCard} ${styles.error}`}>{error}</div>}
      {!loading && !error && rows.length === 0 && <div className={styles.stateCard}>No attendance records for this session yet.</div>}

      {!loading && !error && rows.length > 0 && (
        <div className={styles.cardList}>
          {rows.map((row) => (
            <article className={styles.guestCard} key={row.id}>
              <div className={styles.guestMain}>
                <h2 className={styles.guestName}>{row.guestName}</h2>
                <div className={styles.guestMeta}>
                  <span>{row.mainBooker ? "Main booker" : "Guest"}</span>
                  <span>Guest Pass {row.passNumber} / {row.totalPasses}</span>
                  {row.markedAt && <span>Marked {formatDateTime(row.markedAt)}</span>}
                  {row.markedByGuideId && <span>By #{row.markedByGuideId.slice(0, 8)}</span>}
                </div>
              </div>
              <span className={statusClass(row.attendanceStatus)}>{row.attendanceStatus.replace("_", " ")}</span>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

import { useCallback, useEffect, useMemo, useState } from "react";
import * as GuestPassApi from "../api/guestPass.api";
import type { GuideGuestPassAttendance } from "../api/guestPass.api";
import styles from "../style/guide-attendance.module.css";

type StatusFilter = "ALL" | "UPCOMING" | "PAST" | "CANCELLED";
type SessionStatus = Exclude<StatusFilter, "ALL">;

type AttendanceSession = {
  key: string;
  sessionId: string;
  title: string;
  sessionStartAt: string | null;
  status: SessionStatus;
  rows: GuideGuestPassAttendance[];
  present: number;
  absent: number;
  notMarked: number;
  cancelled: number;
};

const filters: Array<{ key: StatusFilter; label: string }> = [
  { key: "ALL", label: "All" },
  { key: "UPCOMING", label: "Upcoming" },
  { key: "PAST", label: "Past" },
  { key: "CANCELLED", label: "Canceled" },
];

function formatDateTime(iso?: string | null): string {
  if (!iso) return "Date unavailable";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatMonth(iso?: string | null): string {
  if (!iso) return "Unscheduled";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "Unscheduled";
  return date.toLocaleString("en-US", { month: "long", year: "numeric" });
}

function toDateInputValue(iso?: string | null): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

function formatError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error || "");
  if (/HTTP 401/i.test(message)) return "Guide login required.";
  return message || "Could not load attendance history.";
}

function statusLabel(status: SessionStatus): string {
  if (status === "PAST") return "Completed";
  if (status === "CANCELLED") return "Cancelled";
  return "Upcoming";
}

function statusClass(status: string) {
  return `${styles.badge} ${styles[`badge${status}`] ?? ""}`;
}

function attendanceLabel(status: string): string {
  if (status === "NOT_MARKED") return "Not checked in";
  return status.replace("_", " ");
}

function sessionKey(row: GuideGuestPassAttendance): string {
  return `${row.sessionId}|${row.activityTitle ?? "Activity"}|${row.sessionStartAt ?? ""}`;
}

function getSessionStatus(rows: GuideGuestPassAttendance[], sessionStartAt: string | null): SessionStatus {
  if (rows.length > 0 && rows.every((row) => row.status === "CANCELLED")) return "CANCELLED";
  const start = sessionStartAt ? new Date(sessionStartAt).getTime() : Number.NaN;
  if (!Number.isNaN(start) && start > Date.now()) return "UPCOMING";
  return "PAST";
}

function buildSessions(rows: GuideGuestPassAttendance[]): AttendanceSession[] {
  const map = new Map<string, GuideGuestPassAttendance[]>();

  for (const row of rows) {
    const key = sessionKey(row);
    map.set(key, [...(map.get(key) ?? []), row]);
  }

  return Array.from(map.entries())
    .map(([key, groupRows]) => {
      const first = groupRows[0];
      const sessionStartAt = first.sessionStartAt;
      return {
        key,
        sessionId: first.sessionId,
        title: first.activityTitle ?? "Activity",
        sessionStartAt,
        status: getSessionStatus(groupRows, sessionStartAt),
        rows: groupRows,
        present: groupRows.filter((row) => row.attendanceStatus === "PRESENT").length,
        absent: groupRows.filter((row) => row.attendanceStatus === "ABSENT").length,
        notMarked: groupRows.filter((row) => row.attendanceStatus === "NOT_MARKED").length,
        cancelled: groupRows.filter((row) => row.status === "CANCELLED").length,
      };
    })
    .sort((a, b) => {
      const left = a.sessionStartAt ? new Date(a.sessionStartAt).getTime() : 0;
      const right = b.sessionStartAt ? new Date(b.sessionStartAt).getTime() : 0;
      return right - left;
    });
}

export default function GuideAttendanceHistoryPage() {
  const [rows, setRows] = useState<GuideGuestPassAttendance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<StatusFilter>("ALL");
  const [query, setQuery] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  const [expandedKey, setExpandedKey] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setRows(await GuestPassApi.getGuideAttendanceHistory());
    } catch (err) {
      setError(formatError(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const sessions = useMemo(() => buildSessions(rows), [rows]);

  const stats = useMemo(
    () => ({
      attended: rows.filter((row) => row.attendanceStatus === "PRESENT").length,
      upcoming: sessions.filter((session) => session.status === "UPCOMING").length,
      past: sessions.filter((session) => session.status === "PAST").length,
      cancelled: sessions.filter((session) => session.status === "CANCELLED").length,
    }),
    [rows, sessions]
  );

  const filteredSessions = useMemo(() => {
    const needle = query.trim().toLowerCase();

    return sessions.filter((session) => {
      const matchesStatus = filter === "ALL" || session.status === filter;
      const matchesDate = !dateFilter || toDateInputValue(session.sessionStartAt) === dateFilter;
      const matchesSearch =
        !needle ||
        session.title.toLowerCase().includes(needle) ||
        session.rows.some((row) => row.guestName.toLowerCase().includes(needle));

      return matchesStatus && matchesDate && matchesSearch;
    });
  }, [sessions, filter, dateFilter, query]);

  const monthGroups = useMemo(() => {
    const map = new Map<string, AttendanceSession[]>();

    for (const session of filteredSessions) {
      const key = formatMonth(session.sessionStartAt);
      map.set(key, [...(map.get(key) ?? []), session]);
    }

    return Array.from(map.entries()).map(([month, monthSessions]) => ({
      month,
      sessions: monthSessions,
    }));
  }, [filteredSessions]);

  const hasFilters = filter !== "ALL" || query.trim() !== "" || dateFilter !== "";

  return (
    <section className={styles.page}>
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>Attendance history</p>
          <h1 className={styles.title}>Guide attendance</h1>
          <p className={styles.subtitle}>Scan past sessions, guest presence, and upcoming check-in work.</p>
        </div>
        <button className={styles.refreshBtn} type="button" onClick={load}>
          Refresh
        </button>
      </header>

      <div className={styles.statsGrid} aria-label="Attendance summary">
        <div className={styles.statCard}>
          <span>Total attended</span>
          <strong>{stats.attended}</strong>
        </div>
        <div className={styles.statCard}>
          <span>Upcoming</span>
          <strong>{stats.upcoming}</strong>
        </div>
        <div className={styles.statCard}>
          <span>Past sessions</span>
          <strong>{stats.past}</strong>
        </div>
        <div className={styles.statCard}>
          <span>Cancelled</span>
          <strong>{stats.cancelled}</strong>
        </div>
      </div>

      <div className={styles.toolbar}>
        <div className={styles.segmented} role="group" aria-label="Filter sessions">
          {filters.map((item) => (
            <button
              className={`${styles.segmentButton} ${filter === item.key ? styles.segmentActive : ""}`}
              type="button"
              key={item.key}
              onClick={() => setFilter(item.key)}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className={styles.controls}>
          <label className={styles.searchWrap}>
            <span>Search</span>
            <input
              className={styles.search}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Activity or guest"
            />
          </label>
          <label className={styles.dateWrap}>
            <span>Date</span>
            <input
              className={styles.dateInput}
              type="date"
              value={dateFilter}
              onChange={(event) => setDateFilter(event.target.value)}
            />
          </label>
        </div>
      </div>

      {loading && (
        <div className={styles.skeletonList} aria-label="Loading attendance history">
          {Array.from({ length: 6 }).map((_, index) => (
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
          <h2>Could not load attendance</h2>
          <p>{error}</p>
          <button className={styles.refreshBtn} type="button" onClick={load}>
            Try again
          </button>
        </div>
      )}

      {!loading && !error && rows.length === 0 && (
        <div className={styles.emptyState}>
          <div className={styles.emptyIllustration} aria-hidden="true">UT</div>
          <h2>No attendance history yet</h2>
          <p>Once guests start checking in, your completed sessions will appear here in a clean timeline.</p>
          <button className={styles.refreshBtn} type="button" onClick={load}>
            Refresh
          </button>
        </div>
      )}

      {!loading && !error && rows.length > 0 && monthGroups.length === 0 && (
        <div className={styles.stateCard}>
          <h2>No matching records</h2>
          <p>Try clearing the search, date, or status filter.</p>
          {hasFilters && (
            <button
              className={styles.clearBtn}
              type="button"
              onClick={() => {
                setFilter("ALL");
                setQuery("");
                setDateFilter("");
              }}
            >
              Clear filters
            </button>
          )}
        </div>
      )}

      {!loading && !error && monthGroups.length > 0 && (
        <div className={styles.timeline}>
          {monthGroups.map((group) => (
            <section className={styles.monthGroup} key={group.month}>
              <h2 className={styles.monthTitle}>{group.month}</h2>
              <div className={styles.sessionList}>
                {group.sessions.map((session) => {
                  const expanded = expandedKey === session.key;
                  return (
                    <article className={styles.sessionRow} key={session.key}>
                      <button
                        className={styles.rowButton}
                        type="button"
                        onClick={() => setExpandedKey(expanded ? null : session.key)}
                        aria-expanded={expanded}
                      >
                        <div className={styles.thumb} aria-hidden="true">
                          {session.title.slice(0, 2).toUpperCase()}
                        </div>
                        <div className={styles.rowMain}>
                          <div className={styles.rowTop}>
                            <h3>{session.title}</h3>
                            <span className={statusClass(session.status)}>{statusLabel(session.status)}</span>
                          </div>
                          <div className={styles.rowMeta}>
                            <span>{formatDateTime(session.sessionStartAt)}</span>
                            <span>Location not provided</span>
                            <span>{session.rows.length} guests</span>
                          </div>
                        </div>
                        <div className={styles.rowSummary}>
                          <strong>{session.present}</strong>
                          <span>present</span>
                        </div>
                      </button>

                      <div className={styles.rowActions}>
                        <a
                          className={styles.actionLink}
                          href={`/guide/sessions/${session.sessionId}/attendance`}
                          onClick={(event) => event.stopPropagation()}
                        >
                          View
                        </a>
                      </div>

                      {expanded && (
                        <div className={styles.detailsPanel}>
                          <div className={styles.detailSummary}>
                            <span>{session.present} present</span>
                            <span>{session.absent} absent</span>
                            <span>{session.notMarked} not checked in</span>
                            {session.cancelled > 0 && <span>{session.cancelled} cancelled</span>}
                          </div>
                          <div className={styles.passList}>
                            {session.rows.map((row) => (
                              <div className={styles.passRow} key={row.id}>
                                <div>
                                  <strong>{row.guestName}</strong>
                                  <span>
                                    {row.mainBooker ? "Main booker" : "Guest"} · Pass {row.passNumber} of {row.totalPasses}
                                  </span>
                                </div>
                                <div className={styles.passStatus}>
                                  <span className={statusClass(row.status === "CANCELLED" ? "CANCELLED" : row.attendanceStatus)}>
                                    {row.status === "CANCELLED" ? "Cancelled" : attendanceLabel(row.attendanceStatus)}
                                  </span>
                                  {row.markedAt && <small>{formatDateTime(row.markedAt)}</small>}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}
    </section>
  );
}

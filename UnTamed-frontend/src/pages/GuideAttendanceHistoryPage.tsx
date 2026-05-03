import { useCallback, useEffect, useMemo, useState } from "react";
import * as GuestPassApi from "../api/guestPass.api";
import type { AttendanceStatus, GuideGuestPassAttendance } from "../api/guestPass.api";
import styles from "../style/guide-attendance.module.css";

type FilterKey = "ALL" | AttendanceStatus;

const filters: Array<{ key: FilterKey; label: string }> = [
  { key: "ALL", label: "All" },
  { key: "PRESENT", label: "Present" },
  { key: "ABSENT", label: "Absent" },
  { key: "NOT_MARKED", label: "Not marked" },
];

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
  return message || "Could not load attendance history.";
}

function statusClass(status: string) {
  return `${styles.badge} ${styles[`badge${status}`] ?? ""}`;
}

function groupKey(row: GuideGuestPassAttendance): string {
  return `${row.sessionId}|${row.activityTitle ?? "Activity"}|${row.sessionStartAt ?? ""}`;
}

export default function GuideAttendanceHistoryPage() {
  const [rows, setRows] = useState<GuideGuestPassAttendance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<FilterKey>("ALL");
  const [query, setQuery] = useState("");

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

  useEffect(() => { void load(); }, [load]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return rows.filter((row) => {
      const matchesStatus = filter === "ALL" || row.attendanceStatus === filter;
      const matchesSearch =
        !needle ||
        row.guestName.toLowerCase().includes(needle) ||
        (row.activityTitle ?? "").toLowerCase().includes(needle);
      return matchesStatus && matchesSearch;
    });
  }, [rows, filter, query]);

  const groups = useMemo(() => {
    const map = new Map<string, GuideGuestPassAttendance[]>();
    for (const row of filtered) {
      const key = groupKey(row);
      map.set(key, [...(map.get(key) ?? []), row]);
    }
    return Array.from(map.entries()).map(([key, groupRows]) => {
      const first = groupRows[0];
      return {
        key,
        title: first.activityTitle ?? "Activity",
        sessionStartAt: first.sessionStartAt,
        rows: groupRows,
        present: groupRows.filter((row) => row.attendanceStatus === "PRESENT").length,
        absent: groupRows.filter((row) => row.attendanceStatus === "ABSENT").length,
        notMarked: groupRows.filter((row) => row.attendanceStatus === "NOT_MARKED").length,
      };
    });
  }, [filtered]);

  return (
    <section className={styles.page}>
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>Attendance history</p>
          <h1 className={styles.title}>Guide attendance</h1>
          <p className={styles.subtitle}>Review previous and current guest pass attendance by session.</p>
        </div>
        <button className={styles.refreshBtn} type="button" onClick={load}>Refresh</button>
      </header>

      <div className={styles.toolbar}>
        <input
          className={styles.search}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search guest or activity"
        />
        <div className={styles.filters} role="group" aria-label="Filter attendance">
          {filters.map((item) => (
            <button
              className={`${styles.filterBtn} ${filter === item.key ? styles.filterActive : ""}`}
              type="button"
              key={item.key}
              onClick={() => setFilter(item.key)}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {loading && <div className={styles.stateCard}>Loading attendance history...</div>}
      {!loading && error && <div className={`${styles.stateCard} ${styles.error}`}>{error}</div>}
      {!loading && !error && rows.length === 0 && <div className={styles.stateCard}>No attendance history yet.</div>}
      {!loading && !error && rows.length > 0 && groups.length === 0 && <div className={styles.stateCard}>No matching attendance records.</div>}

      {!loading && !error && groups.length > 0 && (
        <div className={styles.cardList}>
          {groups.map((group) => (
            <section className={styles.sessionGroup} key={group.key}>
              <div className={styles.sessionHeader}>
                <div>
                  <h2>{group.title}</h2>
                  <div className={styles.sessionMeta}>
                    <span>{formatDateTime(group.sessionStartAt)}</span>
                    <span>{group.rows.length} passes</span>
                  </div>
                </div>
                <div className={styles.miniSummary}>
                  {group.present} present / {group.absent} absent / {group.notMarked} not marked
                </div>
              </div>

              <div className={styles.cardList}>
                {group.rows.map((row) => (
                  <article className={styles.guestCard} key={row.id}>
                    <div className={styles.guestMain}>
                      <h3 className={styles.guestName}>{row.guestName}</h3>
                      <div className={styles.guestMeta}>
                        <span>{row.mainBooker ? "Main booker" : "Guest"}</span>
                        <span>Guest Pass {row.passNumber} / {row.totalPasses}</span>
                        {row.markedAt && <span>Marked {formatDateTime(row.markedAt)}</span>}
                      </div>
                    </div>
                    <span className={statusClass(row.attendanceStatus)}>{row.attendanceStatus.replace("_", " ")}</span>
                  </article>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </section>
  );
}

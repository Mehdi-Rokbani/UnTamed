import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Eye, RefreshCw, Search, ShieldCheck } from "lucide-react";
import AdminPagination from "../../components/admin/AdminPagination";
import { getAdminAuditLogs, type AdminAuditLog } from "../../api/admin.api";
import styles from "../../style/admin.module.css";

const actionOptions = [
  "VERIFY_GUIDE",
  "SUSPEND_GUIDE",
  "REACTIVATE_GUIDE",
  "CANCEL_SESSION",
  "PROCESS_REFUND",
  "REFUND_FAILED",
  "SUSPEND_USER",
  "REACTIVATE_USER",
  "DISABLE_ACTIVITY",
  "REPUBLISH_ACTIVITY",
];

const targetOptions = ["USER", "GUIDE", "ACTIVITY", "SESSION", "BOOKING", "REFUND"];
const rangeOptions = [
  { value: "30", label: "Last 30 days" },
  { value: "7", label: "Last 7 days" },
  { value: "90", label: "Last 90 days" },
  { value: "ALL", label: "All time" },
];

function formatDate(value?: string | null) {
  if (!value) return "Unknown";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatDateStack(value?: string | null) {
  if (!value) return { date: "Unknown", time: "" };
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return { date: "Unknown", time: "" };
  return {
    date: new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(date),
    time: new Intl.DateTimeFormat("en-US", {
      hour: "numeric",
      minute: "2-digit",
    }).format(date),
  };
}

function todayLabel() {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(new Date());
}

function formatAction(action: string) {
  return action.replaceAll("_", " ").toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function compactId(value?: string | null) {
  if (!value) return "";
  return value.length <= 12 ? value : `${value.slice(0, 6)}...${value.slice(-4)}`;
}

function initials(value?: string | null) {
  if (!value) return "AD";
  return value
    .split(/\s+|@|\./)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "AD";
}

function actionTone(action: string) {
  if (action.includes("SUSPEND") || action.includes("CANCEL") || action.includes("FAILED")) return styles.auditActionDanger;
  if (action.includes("REACTIVATE") || action.includes("REPUBLISH")) return styles.auditActionSuccess;
  if (action.includes("REPORT") || action.includes("REFUND")) return styles.auditActionInfo;
  if (action.includes("VERIFY") || action.includes("APPROVE")) return styles.auditActionNeutral;
  return styles.auditActionDefault;
}

function fromDateForRange(range: string) {
  if (range === "ALL") return undefined;
  const days = Number(range);
  if (!Number.isFinite(days)) return undefined;
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString().slice(0, 10);
}

function initialSelectValue(value: string | null, options: string[]) {
  if (!value) return "ALL";
  const normalized = value.toUpperCase();
  return options.includes(normalized) ? normalized : "ALL";
}

function initialPageValue(value: string | null) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : 0;
}

function initialPageSizeValue(value: string | null) {
  const parsed = Number(value);
  return [10, 25, 50, 100].includes(parsed) ? parsed : 25;
}

export default function AdminAuditLogsPage() {
  const [searchParams] = useSearchParams();
  const [logs, setLogs] = useState<AdminAuditLog[]>([]);
  const [page, setPage] = useState(() => initialPageValue(searchParams.get("page")));
  const [pageSize, setPageSize] = useState(() => initialPageSizeValue(searchParams.get("size")));
  const [totalLogs, setTotalLogs] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState(() => searchParams.get("query") ?? "");
  const [debouncedQuery, setDebouncedQuery] = useState(() => (searchParams.get("query") ?? "").trim());
  const [action, setAction] = useState(() => initialSelectValue(searchParams.get("action"), actionOptions));
  const [targetType, setTargetType] = useState(() => initialSelectValue(searchParams.get("targetType"), targetOptions));
  const [dateRange, setDateRange] = useState(() => searchParams.get("range") ?? "30");
  const [selectedLog, setSelectedLog] = useState<AdminAuditLog | null>(null);

  async function loadLogs() {
    setLoading(true);
    try {
      const data = await getAdminAuditLogs({
        page,
        size: pageSize,
        query: debouncedQuery || undefined,
        action: action === "ALL" ? undefined : action,
        targetType: targetType === "ALL" ? undefined : targetType,
        fromDate: fromDateForRange(dateRange),
      });
      setLogs(data.content);
      setTotalLogs(data.totalElements);
      setTotalPages(data.totalPages);
      setError(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not load audit logs");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setPage(0);
      setDebouncedQuery(query.trim());
    }, 300);

    return () => window.clearTimeout(timeout);
  }, [query]);

  useEffect(() => {
    void loadLogs();
  }, [page, pageSize, debouncedQuery, action, targetType, dateRange]);

  function updateActionFilter(value: string) {
    setPage(0);
    setAction(value);
  }

  function updateTargetTypeFilter(value: string) {
    setPage(0);
    setTargetType(value);
  }

  function updateDateRange(value: string) {
    setPage(0);
    setDateRange(value);
  }

  function updatePageSize(value: number) {
    setPage(0);
    setPageSize(value);
  }

  function clearFilters() {
    setPage(0);
    setQuery("");
    setDebouncedQuery("");
    setAction("ALL");
    setTargetType("ALL");
    setDateRange("30");
  }

  const suspensions = logs.filter((log) => log.action.includes("SUSPEND")).length;
  const reportsResolved = logs.filter((log) => log.action.includes("REPORT") && log.action.includes("RESOL")).length;
  const adminsActive = new Set(logs.map((log) => log.adminEmail || log.adminId).filter(Boolean)).size;
  const currentRangeLabel = rangeOptions.find((option) => option.value === dateRange)?.label.toLowerCase() ?? "selected range";

  return (
    <div className={styles.auditPage}>
      <div className={styles.auditHeader}>
        <div>
          <h1 className={styles.auditTitle}>Audit logs</h1>
          <p className={styles.auditSubtitle}>
            Trace sensitive admin actions, targets, and what changed - {todayLabel()}
          </p>
        </div>
        <button className={styles.auditRefreshButton} type="button" onClick={() => void loadLogs()} disabled={loading}>
          <RefreshCw size={16} />
          <span>{loading ? "Refreshing" : "Refresh"}</span>
        </button>
      </div>

      {error && (
        <div className={`${styles.notice} ${styles.noticeError}`}>
          <span>{error}</span>
          <div className={styles.noticeActions}>
            <button className={styles.button} type="button" onClick={() => void loadLogs()} disabled={loading}>
              Retry
            </button>
          </div>
        </div>
      )}
      {loading && <p className={styles.pageSubtitle}>Loading audit logs...</p>}

      <section className={styles.auditStatsGrid} aria-label="Audit log summary">
        <article className={styles.auditStatCard}>
          <span><ShieldCheck size={14} /></span>
          <p>Total actions</p>
          <strong>{totalLogs}</strong>
          <small>{currentRangeLabel}</small>
        </article>
        <article className={styles.auditStatCard}>
          <span><ShieldCheck size={14} /></span>
          <p>Suspensions</p>
          <strong>{suspensions}</strong>
          <small>visible page</small>
        </article>
        <article className={styles.auditStatCard}>
          <span><ShieldCheck size={14} /></span>
          <p>Reports resolved</p>
          <strong>{reportsResolved}</strong>
          <small>visible page</small>
        </article>
        <article className={styles.auditStatCard}>
          <span><ShieldCheck size={14} /></span>
          <p>Admins active</p>
          <strong>{adminsActive}</strong>
          <small>visible page</small>
        </article>
      </section>

      <section className={styles.auditFiltersPanel} aria-label="Audit log filters">
        <label className={styles.auditSearchBox}>
          <Search size={18} />
            <input
              type="search"
              placeholder="Search admin, target, reason..."
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
        </label>
        <select className={styles.auditSelect} value={action} onChange={(event) => updateActionFilter(event.target.value)}>
          <option value="ALL">All actions</option>
          {actionOptions.map((option) => (
            <option key={option} value={option}>{formatAction(option)}</option>
          ))}
        </select>
        <select
          className={styles.auditSelect}
          value={targetType}
          onChange={(event) => updateTargetTypeFilter(event.target.value)}
        >
          <option value="ALL">All targets</option>
          {targetOptions.map((option) => (
            <option key={option} value={option}>{option}</option>
          ))}
        </select>
        <select className={styles.auditSelect} value={dateRange} onChange={(event) => updateDateRange(event.target.value)}>
          {rangeOptions.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
        <button className={styles.auditClearButton} type="button" onClick={clearFilters} disabled={loading}>
          Clear filters
        </button>
      </section>

      <section className={styles.auditTableCard}>
        <div className={styles.auditTableWrap}>
          <table className={styles.auditTable}>
            <thead>
              <tr>
                <th>Date</th>
                <th>Admin</th>
                <th>Action</th>
                <th>Target</th>
                <th>Reason</th>
                <th aria-label="Details" />
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => {
                const stamped = formatDateStack(log.createdAt);

                return (
                  <tr key={log.id}>
                    <td>
                      <strong>{stamped.date}</strong>
                      <span>{stamped.time}</span>
                    </td>
                    <td>
                      <div className={styles.auditAdminCell}>
                        <span>{initials(log.adminEmail || log.adminId)}</span>
                        <div>
                          <strong>{log.adminEmail?.split("@")[0] || "Unknown"}</strong>
                          <small>{compactId(log.adminId)}</small>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className={`${styles.auditActionPill} ${actionTone(log.action)}`}>
                        {formatAction(log.action)}
                      </span>
                    </td>
                    <td>
                      <strong>{log.targetLabel || log.targetType}</strong>
                      <span>{log.targetType} {compactId(log.targetId)}</span>
                    </td>
                    <td>
                      <span className={styles.auditReason}>{log.reason || log.details || "-"}</span>
                    </td>
                    <td>
                      <button
                        className={styles.auditIconButton}
                        type="button"
                        onClick={() => setSelectedLog(log)}
                        aria-label="View audit details"
                      >
                        <Eye size={16} />
                      </button>
                    </td>
                  </tr>
                );
              })}

              {!loading && logs.length === 0 && (
                <tr>
                  <td className={styles.auditEmpty} colSpan={6}>
                    No audit logs match the selected filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <AdminPagination
          page={page}
          size={pageSize}
          totalElements={totalLogs}
          totalPages={totalPages}
          loading={loading}
          onPageChange={setPage}
          onSizeChange={updatePageSize}
        />
      </section>

      {selectedLog && (
        <div className={styles.modalBackdrop} role="presentation" onMouseDown={() => setSelectedLog(null)}>
          <section className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="audit-detail-title" onMouseDown={(event) => event.stopPropagation()}>
            <div className={styles.modalHeader}>
              <div>
                <p className={styles.pageSubtitle}>Audit detail</p>
                <h2 className={styles.modalTitle} id="audit-detail-title">{formatAction(selectedLog.action)}</h2>
              </div>
              <button className={styles.button} type="button" onClick={() => setSelectedLog(null)}>Close</button>
            </div>
            <div className={styles.resultGrid}>
              <div className={styles.resultItem}><span>Date</span><strong>{formatDate(selectedLog.createdAt)}</strong></div>
              <div className={styles.resultItem}><span>Admin</span><strong>{selectedLog.adminEmail || selectedLog.adminId || "Unknown"}</strong></div>
              <div className={styles.resultItem}><span>Target</span><strong>{selectedLog.targetLabel || selectedLog.targetId}</strong></div>
              <div className={styles.resultItem}><span>Type</span><strong>{selectedLog.targetType}</strong></div>
            </div>
            <p className={styles.modalHint}>{selectedLog.reason || "No reason provided."}</p>
            <p className={styles.modalHint}>{selectedLog.details || "No extra details recorded."}</p>
          </section>
        </div>
      )}
    </div>
  );
}

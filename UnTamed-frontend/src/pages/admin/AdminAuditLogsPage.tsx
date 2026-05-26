import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import AdminDataTable from "../../components/admin/AdminDataTable";
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

function formatAction(action: string) {
  return action.replaceAll("_", " ").toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());
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
  const [fromDate, setFromDate] = useState(() => searchParams.get("fromDate") ?? "");
  const [toDate, setToDate] = useState(() => searchParams.get("toDate") ?? "");

  async function loadLogs() {
    setLoading(true);
    try {
      const data = await getAdminAuditLogs({
        page,
        size: pageSize,
        query: debouncedQuery || undefined,
        action: action === "ALL" ? undefined : action,
        targetType: targetType === "ALL" ? undefined : targetType,
        fromDate: fromDate || undefined,
        toDate: toDate || undefined,
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
  }, [page, pageSize, debouncedQuery, action, targetType, fromDate, toDate]);

  function updateActionFilter(value: string) {
    setPage(0);
    setAction(value);
  }

  function updateTargetTypeFilter(value: string) {
    setPage(0);
    setTargetType(value);
  }

  function updateFromDate(value: string) {
    setPage(0);
    setFromDate(value);
  }

  function updateToDate(value: string) {
    setPage(0);
    setToDate(value);
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
    setFromDate("");
    setToDate("");
  }

  return (
    <>
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>Audit Logs</h1>
          <p className={styles.pageSubtitle}>
            Trace sensitive admin actions, who performed them, and what they changed.
          </p>
        </div>
        <button className={styles.button} type="button" onClick={() => void loadLogs()} disabled={loading}>
          Refresh
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

      <section className={styles.panel}>
        <div className={styles.panelHeader}>
          <div className={styles.toolbar}>
            <input
              className={styles.search}
              type="search"
              placeholder="Search admin, target, reason, or details"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
            <div className={styles.filters}>
              <select className={styles.select} value={action} onChange={(event) => updateActionFilter(event.target.value)}>
                <option value="ALL">All actions</option>
                {actionOptions.map((option) => (
                  <option key={option} value={option}>{formatAction(option)}</option>
                ))}
              </select>
              <select
                className={styles.select}
                value={targetType}
                onChange={(event) => updateTargetTypeFilter(event.target.value)}
              >
                <option value="ALL">All targets</option>
                {targetOptions.map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
              <input
                className={styles.select}
                type="date"
                value={fromDate}
                onChange={(event) => updateFromDate(event.target.value)}
                aria-label="From date"
              />
              <input
                className={styles.select}
                type="date"
                value={toDate}
                onChange={(event) => updateToDate(event.target.value)}
                aria-label="To date"
              />
            </div>
            <button className={styles.button} type="button" onClick={clearFilters} disabled={loading}>
              Clear filters
            </button>
          </div>
        </div>

        <AdminDataTable columns={["Date", "Admin", "Action", "Target", "Reason", "Details"]}>
          {logs.map((log) => (
            <tr key={log.id}>
              <td className={styles.mutedText}>{formatDate(log.createdAt)}</td>
              <td>
                <p className={styles.identityName}>{log.adminEmail || "Unknown admin"}</p>
                {log.adminId && <p className={styles.mutedText}>{log.adminId}</p>}
              </td>
              <td>{formatAction(log.action)}</td>
              <td>
                <p className={styles.identityName}>{log.targetLabel || log.targetId}</p>
                <p className={styles.mutedText}>{log.targetType} - {log.targetId}</p>
              </td>
              <td className={styles.mutedText}>{log.reason || "-"}</td>
              <td className={styles.mutedText}>{log.details || "-"}</td>
            </tr>
          ))}

          {!loading && logs.length === 0 && (
            <tr>
              <td className={styles.mutedText} colSpan={6}>
                No audit logs match the selected filters.
              </td>
            </tr>
          )}
        </AdminDataTable>

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
    </>
  );
}

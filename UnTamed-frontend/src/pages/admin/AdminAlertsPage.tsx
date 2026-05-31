import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import AdminDataTable from "../../components/admin/AdminDataTable";
import AdminPagination from "../../components/admin/AdminPagination";
import {
  acknowledgeAdminAlert,
  getAdminAlerts,
  reopenAdminAlert,
  resolveAdminAlert,
  type AdminAlert,
} from "../../api/admin.api";
import styles from "../../style/admin.module.css";

const typeOptions = [
  "PENDING_GUIDE",
  "SUSPENDED_GUIDE",
  "PENDING_REFUND",
  "FAILED_REFUND",
  "CANCELLED_SESSION",
  "DISABLED_ACTIVITY",
];

const severityOptions = ["CRITICAL", "WARNING", "INFO"];
const statusOptions = ["OPEN", "ACKNOWLEDGED", "RESOLVED"];

function formatDate(value?: string | null) {
  if (!value) return "Unknown";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function formatLabel(value: string) {
  return value.replaceAll("_", " ").toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());
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

function severityClass(severity: string) {
  if (severity === "CRITICAL") return styles.badgeSuspended;
  if (severity === "WARNING") return styles.badgePending;
  return styles.badgeApproved;
}

function statusClass(status: string) {
  if (status === "RESOLVED") return styles.badgeApproved;
  if (status === "ACKNOWLEDGED") return styles.badgeInactive;
  return styles.badgePending;
}

export default function AdminAlertsPage() {
  const [searchParams] = useSearchParams();
  const [alerts, setAlerts] = useState<AdminAlert[]>([]);
  const [page, setPage] = useState(() => initialPageValue(searchParams.get("page")));
  const [pageSize, setPageSize] = useState(() => initialPageSizeValue(searchParams.get("size")));
  const [totalAlerts, setTotalAlerts] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busyAlertId, setBusyAlertId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [query, setQuery] = useState(() => searchParams.get("query") ?? "");
  const [debouncedQuery, setDebouncedQuery] = useState(() => (searchParams.get("query") ?? "").trim());
  const [typeFilter, setTypeFilter] = useState(() => initialSelectValue(searchParams.get("type"), typeOptions));
  const [severityFilter, setSeverityFilter] = useState(() => initialSelectValue(searchParams.get("severity"), severityOptions));
  const [statusFilter, setStatusFilter] = useState(() => initialSelectValue(searchParams.get("status"), statusOptions));

  async function loadAlerts() {
    setLoading(true);
    try {
      const data = await getAdminAlerts({
        page,
        size: pageSize,
        query: debouncedQuery || undefined,
        type: typeFilter === "ALL" ? undefined : typeFilter,
        severity: severityFilter === "ALL" ? undefined : severityFilter,
        status: statusFilter === "ALL" ? undefined : statusFilter,
      });
      setAlerts(data.content);
      setTotalAlerts(data.totalElements);
      setTotalPages(data.totalPages);
      setError(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not load admin alerts");
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
    void loadAlerts();
  }, [page, pageSize, debouncedQuery, typeFilter, severityFilter, statusFilter]);

  function updateTypeFilter(value: string) {
    setPage(0);
    setTypeFilter(value);
  }

  function updateSeverityFilter(value: string) {
    setPage(0);
    setSeverityFilter(value);
  }

  function updateStatusFilter(value: string) {
    setPage(0);
    setStatusFilter(value);
  }

  function updatePageSize(value: number) {
    setPage(0);
    setPageSize(value);
  }

  function clearFilters() {
    setPage(0);
    setQuery("");
    setDebouncedQuery("");
    setTypeFilter("ALL");
    setSeverityFilter("ALL");
    setStatusFilter("ALL");
  }

  async function runAlertAction(alert: AdminAlert, action: "acknowledge" | "resolve" | "reopen") {
    setBusyAlertId(alert.id);
    setError(null);
    setSuccess(null);

    try {
      if (action === "acknowledge") {
        await acknowledgeAdminAlert(alert.id);
        setSuccess("Alert acknowledged.");
      } else if (action === "resolve") {
        await resolveAdminAlert(alert.id);
        setSuccess("Alert resolved.");
      } else {
        await reopenAdminAlert(alert.id);
        setSuccess("Alert reopened.");
      }
      await loadAlerts();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Alert action failed");
    } finally {
      setBusyAlertId(null);
    }
  }

  function renderAlertActions(alert: AdminAlert) {
    const busy = busyAlertId === alert.id;

    return (
      <div className={styles.actions}>
        <Link className={styles.sectionLink} to={alert.route}>
          Open
        </Link>
        {alert.status === "OPEN" && (
          <button className={styles.button} type="button" disabled={busy} onClick={() => void runAlertAction(alert, "acknowledge")}>
            {busy ? "Working..." : "Acknowledge"}
          </button>
        )}
        {alert.status !== "RESOLVED" && (
          <button className={`${styles.button} ${styles.buttonAccent}`} type="button" disabled={busy} onClick={() => void runAlertAction(alert, "resolve")}>
            Resolve
          </button>
        )}
        {alert.status === "RESOLVED" && (
          <button className={styles.button} type="button" disabled={busy} onClick={() => void runAlertAction(alert, "reopen")}>
            Reopen
          </button>
        )}
      </div>
    );
  }

  return (
    <>
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>Alerts</h1>
          <p className={styles.pageSubtitle}>
            Operational alerts generated from guide verification, refunds, sessions, and activity moderation.
          </p>
        </div>
        <button className={styles.button} type="button" onClick={() => void loadAlerts()} disabled={loading}>
          Refresh
        </button>
      </div>

      {error && (
        <div className={`${styles.notice} ${styles.noticeError}`}>
          <span>{error}</span>
          <div className={styles.noticeActions}>
            <button className={styles.button} type="button" onClick={() => void loadAlerts()} disabled={loading}>
              Retry
            </button>
          </div>
        </div>
      )}
      {success && <p className={`${styles.notice} ${styles.noticeSuccess}`}>{success}</p>}
      {loading && <p className={styles.pageSubtitle}>Loading alerts...</p>}

      <section className={styles.panel}>
        <div className={styles.panelHeader}>
          <div className={styles.toolbar}>
            <input
              className={styles.search}
              type="search"
              placeholder="Search alerts"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
            <div className={styles.filters}>
              <select className={styles.select} value={typeFilter} onChange={(event) => updateTypeFilter(event.target.value)}>
                <option value="ALL">All types</option>
                {typeOptions.map((option) => (
                  <option key={option} value={option}>{formatLabel(option)}</option>
                ))}
              </select>
              <select className={styles.select} value={severityFilter} onChange={(event) => updateSeverityFilter(event.target.value)}>
                <option value="ALL">All severities</option>
                {severityOptions.map((option) => (
                  <option key={option} value={option}>{formatLabel(option)}</option>
                ))}
              </select>
              <select className={styles.select} value={statusFilter} onChange={(event) => updateStatusFilter(event.target.value)}>
                <option value="ALL">All statuses</option>
                {statusOptions.map((option) => (
                  <option key={option} value={option}>{formatLabel(option)}</option>
                ))}
              </select>
            </div>
            <button className={styles.button} type="button" onClick={clearFilters} disabled={loading}>
              Clear filters
            </button>
          </div>
        </div>

        <AdminDataTable columns={["Report", "Reported entity", "Reason", "Status", "Created", "Actions"]}>
          {alerts.map((alert) => (
            <tr key={alert.id}>
              <td>
                <p className={styles.identityName}>{alert.title}</p>
                <p className={styles.mutedText}>{formatLabel(alert.type)}</p>
              </td>
              <td>
                <p className={styles.identityName}>{alert.entityType}</p>
                <p className={styles.mutedText}>{alert.entityId}</p>
              </td>
              <td>
                <span className={`${styles.badge} ${severityClass(alert.severity)}`}>{formatLabel(alert.severity)}</span>
                <p className={styles.mutedText}>{alert.description}</p>
              </td>
              <td><span className={`${styles.badge} ${statusClass(alert.status)}`}>{alert.status}</span></td>
              <td className={styles.mutedText}>{formatDate(alert.createdAt)}</td>
              <td>{renderAlertActions(alert)}</td>
            </tr>
          ))}

          {!loading && alerts.length === 0 && (
            <tr>
              <td className={styles.mutedText} colSpan={6}>
                No reports or alerts match the selected filters.
              </td>
            </tr>
          )}
        </AdminDataTable>

        <AdminPagination
          page={page}
          size={pageSize}
          totalElements={totalAlerts}
          totalPages={totalPages}
          loading={loading}
          onPageChange={setPage}
          onSizeChange={updatePageSize}
        />
      </section>
    </>
  );
}

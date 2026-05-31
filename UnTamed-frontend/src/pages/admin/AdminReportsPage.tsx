import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import AdminDataTable from "../../components/admin/AdminDataTable";
import AdminPagination from "../../components/admin/AdminPagination";
import {
  cancelAdminSession,
  disableAdminActivity,
  getAdminReport,
  getAdminReports,
  reactivateGuide,
  reactivateUser,
  rejectAdminReport,
  republishAdminActivity,
  resolveAdminReport,
  suspendGuide,
  suspendUser,
  type AdminReport,
} from "../../api/admin.api";
import styles from "../../style/admin.module.css";

const statusOptions = ["PENDING", "RESOLVED", "REJECTED"];
const targetOptions = ["ACCOUNT", "GUIDE", "ACTIVITY", "USER", "SESSION"];
const reasonOptions = [
  "SUSPENSION_APPEAL",
  "FAKE_INFORMATION",
  "INAPPROPRIATE_CONTENT",
  "ABUSE_OR_HARASSMENT",
  "SCAM_OR_FRAUD",
  "SAFETY_CONCERN",
  "NO_SHOW",
  "PAYMENT_OR_BOOKING_ISSUE",
  "SESSION_PROBLEM",
  "OTHER",
];

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

function formatLabel(value?: string | null) {
  if (!value) return "Unknown";
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

function statusClass(status: AdminReport["status"]) {
  if (status === "RESOLVED") return styles.badgeApproved;
  if (status === "REJECTED") return styles.badgeRejected;
  return styles.badgePending;
}

function targetLabel(report: AdminReport) {
  return (
    report.target?.label ||
    report.target?.username ||
    report.target?.activityTitle ||
    report.target?.email ||
    report.targetId
  );
}

function reporterLabel(report: AdminReport) {
  return report.reporterUsername || report.reporterEmail || report.reporterId;
}

function targetRoute(report: AdminReport) {
  if (report.targetType === "GUIDE") return `/admin/guides?query=${encodeURIComponent(report.target?.email || report.targetId)}`;
  if (report.targetType === "USER" || report.targetType === "ACCOUNT") {
    return `/admin/users?query=${encodeURIComponent(report.target?.email || report.targetId)}`;
  }
  if (report.targetType === "ACTIVITY") {
    return `/admin/activities?query=${encodeURIComponent(report.target?.activityTitle || report.targetId)}`;
  }
  if (report.targetType === "SESSION") {
    return `/admin/sessions?query=${encodeURIComponent(report.target?.label || report.targetId)}`;
  }
  return "/admin";
}

function contextFlags(report: AdminReport): Array<[string, boolean]> {
  return [
    ["Booked target", report.reporterBookedTarget],
    ["Completed target", report.reporterCompletedTarget],
    ["Had chat", report.reporterHadChatWithTarget],
    ["In session", report.reporterBelongsToSession],
  ];
}

export default function AdminReportsPage() {
  const [searchParams] = useSearchParams();
  const [reports, setReports] = useState<AdminReport[]>([]);
  const [selectedReport, setSelectedReport] = useState<AdminReport | null>(null);
  const [page, setPage] = useState(() => initialPageValue(searchParams.get("page")));
  const [pageSize, setPageSize] = useState(() => initialPageSizeValue(searchParams.get("size")));
  const [totalReports, setTotalReports] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busyReportId, setBusyReportId] = useState<string | null>(null);
  const [busyModerationAction, setBusyModerationAction] = useState<string | null>(null);
  const [reviewNote, setReviewNote] = useState("");
  const [moderationNote, setModerationNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState(() => initialSelectValue(searchParams.get("status"), statusOptions));
  const [targetFilter, setTargetFilter] = useState(() => initialSelectValue(searchParams.get("targetType"), targetOptions));
  const [reasonFilter, setReasonFilter] = useState(() => initialSelectValue(searchParams.get("reason"), reasonOptions));

  async function loadReports() {
    setLoading(true);
    try {
      const data = await getAdminReports({
        page,
        size: pageSize,
        status: statusFilter === "ALL" ? undefined : statusFilter,
        targetType: targetFilter === "ALL" ? undefined : targetFilter,
        reason: reasonFilter === "ALL" ? undefined : reasonFilter,
      });
      setReports(data.content);
      setTotalReports(data.totalElements);
      setTotalPages(data.totalPages);
      setError(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not load reports");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadReports();
  }, [page, pageSize, statusFilter, targetFilter, reasonFilter]);

  function updateStatusFilter(value: string) {
    setPage(0);
    setStatusFilter(value);
  }

  function updateTargetFilter(value: string) {
    setPage(0);
    setTargetFilter(value);
  }

  function updateReasonFilter(value: string) {
    setPage(0);
    setReasonFilter(value);
  }

  function updatePageSize(value: number) {
    setPage(0);
    setPageSize(value);
  }

  function clearFilters() {
    setPage(0);
    setStatusFilter("ALL");
    setTargetFilter("ALL");
    setReasonFilter("ALL");
  }

  async function openReport(report: AdminReport) {
    setBusyReportId(report.id);
    setError(null);
    setSuccess(null);
    try {
      const data = await getAdminReport(report.id);
      setSelectedReport(data);
      setReviewNote(data.adminNote || "");
      setModerationNote(defaultModerationNote(data));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not load report details");
    } finally {
      setBusyReportId(null);
    }
  }

  async function reviewReport(action: "resolve" | "reject") {
    if (!selectedReport) return;

    setBusyReportId(selectedReport.id);
    setError(null);
    setSuccess(null);

    try {
      const updated =
        action === "resolve"
          ? await resolveAdminReport(selectedReport.id, reviewNote.trim() || undefined)
          : await rejectAdminReport(selectedReport.id, reviewNote.trim() || undefined);

      setSelectedReport(updated);
      setReviewNote(updated.adminNote || "");
      setSuccess(action === "resolve" ? "Report resolved." : "Report rejected.");
      await loadReports();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not update report");
    } finally {
      setBusyReportId(null);
    }
  }

  function closeDetails() {
    setSelectedReport(null);
    setReviewNote("");
    setModerationNote("");
    setBusyModerationAction(null);
  }

  function defaultModerationNote(report: AdminReport) {
    if (report.reason === "SUSPENSION_APPEAL") {
      return `Suspension appeal reviewed from report ${report.id}.`;
    }
    return `${formatLabel(report.reason)} report reviewed from report ${report.id}.`;
  }

  async function reloadSelectedReport(reportId: string) {
    const updated = await getAdminReport(reportId);
    setSelectedReport(updated);
    return updated;
  }

  async function runModerationAction(action: string) {
    if (!selectedReport) return;

    const note = moderationNote.trim();
    if (requiresModerationNote(action) && note.length < 4) {
      setError("Add a short moderation note before running this action.");
      return;
    }

    setBusyModerationAction(action);
    setError(null);
    setSuccess(null);

    try {
      if (action === "reactivate-user") {
        await reactivateUser(selectedReport.targetId);
        setSuccess("Target account reactivated. Resolve the report when your review is complete.");
      } else if (action === "suspend-user") {
        await suspendUser(selectedReport.targetId);
        setSuccess("Target account suspended. Resolve the report when your review is complete.");
      } else if (action === "reactivate-guide") {
        await reactivateGuide(selectedReport.targetId, { notifyGuide: true });
        setSuccess("Guide account reactivated. Resolve the report when your review is complete.");
      } else if (action === "suspend-guide") {
        await suspendGuide(selectedReport.targetId, { reason: note, notifyGuide: true });
        setSuccess("Guide account suspended. Resolve the report when your review is complete.");
      } else if (action === "disable-activity") {
        await disableAdminActivity(selectedReport.targetId, note);
        setSuccess("Activity disabled. Resolve the report when your review is complete.");
      } else if (action === "republish-activity") {
        await republishAdminActivity(selectedReport.targetId, note || undefined);
        setSuccess("Activity republished. Resolve the report when your review is complete.");
      } else if (action === "cancel-session") {
        await cancelAdminSession(selectedReport.targetId, note, true);
        setSuccess("Session cancelled and affected users were notified. Resolve the report when your review is complete.");
      }

      await reloadSelectedReport(selectedReport.id);
      await loadReports();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Moderation action failed");
    } finally {
      setBusyModerationAction(null);
    }
  }

  function requiresModerationNote(action: string) {
    return action === "suspend-guide" || action === "disable-activity" || action === "cancel-session";
  }

  function moderationActions(report: AdminReport) {
    if (report.targetType === "ACCOUNT") {
      return report.target?.suspended === false
        ? []
        : [{ key: "reactivate-user", label: "Reactivate account", tone: "accent" as const }];
    }

    if (report.targetType === "USER") {
      return report.target?.suspended
        ? [{ key: "reactivate-user", label: "Reactivate user", tone: "accent" as const }]
        : [{ key: "suspend-user", label: "Suspend user", tone: "danger" as const }];
    }

    if (report.targetType === "GUIDE") {
      return report.target?.suspended
        ? [{ key: "reactivate-guide", label: "Reactivate guide", tone: "accent" as const }]
        : [{ key: "suspend-guide", label: "Suspend guide", tone: "danger" as const }];
    }

    if (report.targetType === "ACTIVITY") {
      return report.target?.activityStatus === "DISABLED"
        ? [{ key: "republish-activity", label: "Republish activity", tone: "accent" as const }]
        : [{ key: "disable-activity", label: "Disable activity", tone: "danger" as const }];
    }

    if (report.targetType === "SESSION") {
      return report.target?.sessionStatus === "CANCELLED"
        ? []
        : [{ key: "cancel-session", label: "Cancel session", tone: "danger" as const }];
    }

    return [];
  }

  const pendingCount = reports.filter((report) => report.status === "PENDING").length;
  const appealCount = reports.filter((report) => report.reason === "SUSPENSION_APPEAL").length;
  const busySelected = selectedReport ? busyReportId === selectedReport.id : false;
  const currentModerationActions = selectedReport ? moderationActions(selectedReport) : [];

  return (
    <>
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>Reports & Appeals</h1>
          <p className={styles.pageSubtitle}>
            Review user-submitted safety reports and suspended-account appeals before taking manual moderation action.
          </p>
        </div>
        <button className={styles.button} type="button" onClick={() => void loadReports()} disabled={loading}>
          Refresh
        </button>
      </div>

      {error && (
        <div className={`${styles.notice} ${styles.noticeError}`}>
          <span>{error}</span>
          <div className={styles.noticeActions}>
            <button className={styles.button} type="button" onClick={() => void loadReports()} disabled={loading}>
              Retry
            </button>
          </div>
        </div>
      )}
      {success && <p className={`${styles.notice} ${styles.noticeSuccess}`}>{success}</p>}
      {loading && <p className={styles.pageSubtitle}>Loading reports...</p>}

      <section className={styles.reportSummaryGrid} aria-label="Report review summary">
        <button className={styles.reportSummaryCard} type="button" onClick={() => updateStatusFilter("PENDING")}>
          <span>Pending on this page</span>
          <strong>{pendingCount}</strong>
          <small>Needs admin decision</small>
        </button>
        <button className={styles.reportSummaryCard} type="button" onClick={() => updateReasonFilter("SUSPENSION_APPEAL")}>
          <span>Appeals on this page</span>
          <strong>{appealCount}</strong>
          <small>Suspended-account requests</small>
        </button>
        <button className={styles.reportSummaryCard} type="button" onClick={() => updateTargetFilter("ACCOUNT")}>
          <span>Account reports</span>
          <strong>{targetFilter === "ACCOUNT" ? totalReports : "-"}</strong>
          <small>Filter suspension appeals</small>
        </button>
      </section>

      <section className={styles.panel}>
        <div className={styles.panelHeader}>
          <div className={styles.toolbar}>
            <div className={styles.filters}>
              <select className={styles.select} value={statusFilter} onChange={(event) => updateStatusFilter(event.target.value)}>
                <option value="ALL">All statuses</option>
                {statusOptions.map((option) => (
                  <option key={option} value={option}>{formatLabel(option)}</option>
                ))}
              </select>
              <select className={styles.select} value={targetFilter} onChange={(event) => updateTargetFilter(event.target.value)}>
                <option value="ALL">All targets</option>
                {targetOptions.map((option) => (
                  <option key={option} value={option}>{formatLabel(option)}</option>
                ))}
              </select>
              <select className={styles.select} value={reasonFilter} onChange={(event) => updateReasonFilter(event.target.value)}>
                <option value="ALL">All reasons</option>
                {reasonOptions.map((option) => (
                  <option key={option} value={option}>{formatLabel(option)}</option>
                ))}
              </select>
            </div>
            <button className={styles.button} type="button" onClick={clearFilters} disabled={loading}>
              Clear filters
            </button>
          </div>
        </div>

        <AdminDataTable columns={["Report", "Reporter", "Target", "Context", "Status", "Created", "Actions"]}>
          {reports.map((report) => (
            <tr key={report.id}>
              <td>
                <p className={styles.identityName}>
                  {report.reason === "SUSPENSION_APPEAL" ? "Suspension appeal" : formatLabel(report.reason)}
                </p>
                <p className={styles.mutedText}>{report.description}</p>
              </td>
              <td>
                <p className={styles.identityName}>{reporterLabel(report)}</p>
                <p className={styles.mutedText}>{report.reporterEmail || report.reporterId}</p>
              </td>
              <td>
                <p className={styles.identityName}>{targetLabel(report)}</p>
                <p className={styles.mutedText}>{formatLabel(report.targetType)} - {report.targetId}</p>
              </td>
              <td>
                <div className={styles.reportFlagList}>
                  {contextFlags(report).map(([label, active]) => (
                    <span className={active ? styles.reportFlagActive : styles.reportFlag} key={label}>
                      {active ? "Yes" : "No"} {label}
                    </span>
                  ))}
                </div>
              </td>
              <td><span className={`${styles.badge} ${statusClass(report.status)}`}>{formatLabel(report.status)}</span></td>
              <td className={styles.mutedText}>{formatDate(report.createdAt)}</td>
              <td>
                <div className={styles.actions}>
                  <button
                    className={styles.button}
                    type="button"
                    onClick={() => void openReport(report)}
                    disabled={busyReportId === report.id}
                  >
                    {busyReportId === report.id ? "Opening..." : "Review"}
                  </button>
                </div>
              </td>
            </tr>
          ))}

          {!loading && reports.length === 0 && (
            <tr>
              <td className={styles.mutedText} colSpan={7}>
                No reports match the selected filters.
              </td>
            </tr>
          )}
        </AdminDataTable>

        <AdminPagination
          page={page}
          size={pageSize}
          totalElements={totalReports}
          totalPages={totalPages}
          loading={loading}
          onPageChange={setPage}
          onSizeChange={updatePageSize}
        />
      </section>

      {selectedReport && (
        <div className={styles.modalBackdrop} role="presentation" onMouseDown={closeDetails}>
          <section
            className={`${styles.modal} ${styles.wideModal}`}
            role="dialog"
            aria-modal="true"
            aria-labelledby="report-review-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className={styles.modalHeader}>
              <div>
                <h2 className={styles.modalTitle} id="report-review-title">
                  {selectedReport.reason === "SUSPENSION_APPEAL" ? "Suspension appeal" : "Report review"}
                </h2>
                <p className={styles.pageSubtitle}>
                  Submitted {formatDate(selectedReport.createdAt)} by {reporterLabel(selectedReport)}.
                </p>
              </div>
              <span className={`${styles.badge} ${statusClass(selectedReport.status)}`}>
                {formatLabel(selectedReport.status)}
              </span>
            </div>

            <div className={styles.reportDetailGrid}>
              <article className={styles.reportDetailCard}>
                <span>Reason</span>
                <strong>{formatLabel(selectedReport.reason)}</strong>
                <p>{selectedReport.description}</p>
              </article>
              <article className={styles.reportDetailCard}>
                <span>Reported target</span>
                <strong>{targetLabel(selectedReport)}</strong>
                <p>
                  {formatLabel(selectedReport.targetType)} - {selectedReport.target?.email || selectedReport.targetId}
                </p>
                {selectedReport.target?.suspended === true && <small>Target account is currently suspended.</small>}
              </article>
            </div>

            <div className={styles.reportMetaGrid}>
              {contextFlags(selectedReport).map(([label, active]) => (
                <div className={styles.resultItem} key={label}>
                  <span>{label}</span>
                  <strong>{active ? "Yes" : "No"}</strong>
                </div>
              ))}
            </div>

            <div className={styles.reportTargetPanel}>
              <div>
                <p className={styles.panelTitle}>Target details</p>
                <p className={styles.panelSubtitle}>Lightweight context from the reported entity.</p>
              </div>
              <dl>
                <div>
                  <dt>Label</dt>
                  <dd>{targetLabel(selectedReport)}</dd>
                </div>
                <div>
                  <dt>Status</dt>
                  <dd>{selectedReport.target?.activityStatus || selectedReport.target?.sessionStatus || "-"}</dd>
                </div>
                <div>
                  <dt>Role</dt>
                  <dd>{selectedReport.target?.role || "-"}</dd>
                </div>
                <div>
                  <dt>Session start</dt>
                  <dd>{formatDate(selectedReport.target?.sessionStartAt)}</dd>
                </div>
              </dl>
              <Link className={styles.sectionLink} to={targetRoute(selectedReport)}>
                Open related admin page
              </Link>
            </div>

            <div className={styles.reportModerationPanel}>
              <div>
                <p className={styles.panelTitle}>Moderation actions</p>
                <p className={styles.panelSubtitle}>
                  These actions update the reported target. They do not automatically resolve the report.
                </p>
              </div>

              <label className={styles.fieldLabel} htmlFor="admin-moderation-note">
                Moderation note
              </label>
              <textarea
                className={styles.textarea}
                id="admin-moderation-note"
                value={moderationNote}
                onChange={(event) => setModerationNote(event.target.value)}
                placeholder="Reason used for account, guide, activity, or session moderation."
                disabled={Boolean(busyModerationAction)}
                maxLength={1000}
              />

              {currentModerationActions.length > 0 ? (
                <div className={styles.reportActionGrid}>
                  {currentModerationActions.map((action) => (
                    <button
                      className={`${styles.button} ${
                        action.tone === "danger" ? styles.buttonDanger : styles.buttonAccent
                      }`}
                      type="button"
                      key={action.key}
                      onClick={() => void runModerationAction(action.key)}
                      disabled={
                        Boolean(busyModerationAction) ||
                        busySelected ||
                        (requiresModerationNote(action.key) && moderationNote.trim().length < 4)
                      }
                    >
                      {busyModerationAction === action.key ? "Working..." : action.label}
                    </button>
                  ))}
                  <Link className={styles.sectionLink} to={targetRoute(selectedReport)}>
                    Manage manually
                  </Link>
                </div>
              ) : (
                <p className={styles.modalHint}>
                  No direct moderation action is currently available for this target state. Use the related admin page for manual review.
                </p>
              )}
            </div>

            <label className={styles.fieldLabel} htmlFor="admin-report-note">
              Admin note
            </label>
            <textarea
              className={styles.textarea}
              id="admin-report-note"
              value={reviewNote}
              onChange={(event) => setReviewNote(event.target.value)}
              placeholder="Add the decision context that should appear in the moderation record."
              disabled={selectedReport.status !== "PENDING" || busySelected}
              maxLength={2000}
            />

            {selectedReport.reviewedAt && (
              <p className={styles.modalHint}>
                Reviewed {formatDate(selectedReport.reviewedAt)}
                {selectedReport.reviewedByAdminId ? ` by ${selectedReport.reviewedByAdminId}` : ""}.
              </p>
            )}

            <div className={styles.modalActions}>
              <button className={styles.button} type="button" onClick={closeDetails} disabled={busySelected}>
                Close
              </button>
              {selectedReport.status === "PENDING" && (
                <>
                  <button
                    className={`${styles.button} ${styles.buttonDanger}`}
                    type="button"
                    onClick={() => void reviewReport("reject")}
                    disabled={busySelected}
                  >
                    {busySelected ? "Saving..." : "Reject"}
                  </button>
                  <button
                    className={`${styles.button} ${styles.buttonAccent}`}
                    type="button"
                    onClick={() => void reviewReport("resolve")}
                    disabled={busySelected}
                  >
                    {busySelected ? "Saving..." : "Resolve"}
                  </button>
                </>
              )}
            </div>
          </section>
        </div>
      )}
    </>
  );
}

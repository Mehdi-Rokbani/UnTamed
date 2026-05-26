import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import AdminDataTable from "../../components/admin/AdminDataTable";
import AdminPagination from "../../components/admin/AdminPagination";
import AdminStatusBadge, { type AdminStatus } from "../../components/admin/AdminStatusBadge";
import {
  cancelAdminSession,
  getAdminSessions,
  type AdminCancelSessionResponse,
  type AdminSession,
} from "../../api/admin.api";
import styles from "../../style/admin.module.css";

type SessionStatus = Extract<AdminStatus, "DRAFT" | "PUBLISHED" | "CANCELLED" | "COMPLETED">;
const sessionStatusOptions = ["DRAFT", "PUBLISHED", "CANCELLED", "COMPLETED"];

function normalizeSessionStatus(status: string): SessionStatus {
  if (status === "DRAFT" || status === "PUBLISHED" || status === "CANCELLED" || status === "COMPLETED") {
    return status;
  }
  return "DRAFT";
}

function formatDateTime(value?: string | null) {
  if (!value) return "Unscheduled";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatCapacity(session: AdminSession) {
  return `${session.bookedCount} / ${session.capacity}`;
}

function initialStatusValue(value: string | null) {
  const normalized = (value ?? "").toUpperCase();
  return sessionStatusOptions.includes(normalized) ? normalized : "ALL";
}

function initialPageValue(value: string | null) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : 0;
}

function initialPageSizeValue(value: string | null) {
  const parsed = Number(value);
  return [10, 25, 50, 100].includes(parsed) ? parsed : 25;
}

export default function AdminSessionsPage() {
  const [searchParams] = useSearchParams();
  const [sessions, setSessions] = useState<AdminSession[]>([]);
  const [page, setPage] = useState(() => initialPageValue(searchParams.get("page")));
  const [pageSize, setPageSize] = useState(() => initialPageSizeValue(searchParams.get("size")));
  const [totalSessions, setTotalSessions] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [selectedSession, setSelectedSession] = useState<AdminSession | null>(null);
  const [reason, setReason] = useState("");
  const [notifyUsers, setNotifyUsers] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<AdminCancelSessionResponse | null>(null);
  const [query, setQuery] = useState(() => searchParams.get("query") ?? "");
  const [statusFilter, setStatusFilter] = useState(() => initialStatusValue(searchParams.get("status")));
  const [debouncedQuery, setDebouncedQuery] = useState(() => (searchParams.get("query") ?? "").trim());

  async function loadSessions() {
    setLoading(true);
    try {
      const data = await getAdminSessions({
        page,
        size: pageSize,
        query: debouncedQuery || undefined,
        status: statusFilter === "ALL" ? undefined : statusFilter,
      });
      setSessions(data.content);
      setTotalSessions(data.totalElements);
      setTotalPages(data.totalPages);
      setError(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not load sessions");
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
    void loadSessions();
  }, [page, pageSize, debouncedQuery, statusFilter]);

  const cancelDisabled = useMemo(() => reason.trim().length < 4 || submitting, [reason, submitting]);

  function updateStatusFilter(value: string) {
    setPage(0);
    setStatusFilter(value);
  }

  function updatePageSize(value: number) {
    setPage(0);
    setPageSize(value);
  }

  function openCancelModal(session: AdminSession) {
    setSelectedSession(session);
    setReason("");
    setNotifyUsers(true);
    setResult(null);
    setError(null);
    setSuccess(null);
  }

  function closeCancelModal() {
    if (submitting) return;
    setSelectedSession(null);
    setReason("");
    setNotifyUsers(true);
  }

  async function submitCancel() {
    if (!selectedSession || cancelDisabled) return;

    setSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await cancelAdminSession(selectedSession.id, reason.trim(), notifyUsers);
      setResult(response);
      setSuccess(response.message);
      await loadSessions();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not cancel session");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>Sessions Management</h1>
          <p className={styles.pageSubtitle}>
            Cancel individual sessions manually and flag affected bookings for safe follow-up.
          </p>
        </div>
      </div>

      {error && <p className={`${styles.notice} ${styles.noticeError}`}>{error}</p>}
      {success && <p className={`${styles.notice} ${styles.noticeSuccess}`}>{success}</p>}
      {loading && <p className={styles.pageSubtitle}>Loading sessions...</p>}

      {result && (
        <section className={styles.resultPanel} aria-label="Cancellation result">
          <div>
            <p className={styles.resultLabel}>Cancellation summary</p>
            <h2 className={styles.resultTitle}>{result.message}</h2>
          </div>
          <div className={styles.resultGrid}>
            <div className={styles.resultItem}>
              <span>Affected bookings</span>
              <strong>{result.affectedBookings}</strong>
            </div>
            <div className={styles.resultItem}>
              <span>Pending cancelled</span>
              <strong>{result.pendingCancelled}</strong>
            </div>
            <div className={styles.resultItem}>
              <span>Paying needs review</span>
              <strong>{result.payingNeedsReview}</strong>
            </div>
            <div className={styles.resultItem}>
              <span>Paid needs refund</span>
              <strong>{result.paidNeedsRefund}</strong>
            </div>
            <div className={styles.resultItem}>
              <span>Users notified</span>
              <strong>{result.usersNotified}</strong>
            </div>
            <div className={styles.resultItem}>
              <span>Notifications failed</span>
              <strong>{result.notificationsFailed}</strong>
            </div>
          </div>
        </section>
      )}

      <section className={styles.panel}>
        <div className={styles.panelHeader}>
          <div className={styles.toolbar}>
            <input
              className={styles.search}
              type="search"
              placeholder="Search activity, guide, or date"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
            <div className={styles.filters}>
              <select className={styles.select} value={statusFilter} onChange={(event) => updateStatusFilter(event.target.value)}>
                <option value="ALL">All statuses</option>
                <option value="PUBLISHED">Published</option>
                <option value="DRAFT">Draft</option>
                <option value="CANCELLED">Cancelled</option>
                <option value="COMPLETED">Completed</option>
              </select>
            </div>
          </div>
        </div>

        <AdminDataTable columns={["Session", "Guide", "Schedule", "Occupancy", "Status", "Actions"]}>
          {sessions.map((session) => {
            const status = normalizeSessionStatus(session.status);
            return (
              <tr key={session.id}>
                <td>
                  <div className={styles.identity}>
                    <div className={styles.identityAvatar}>SE</div>
                    <div>
                      <p className={styles.identityName}>{session.activityTitle}</p>
                      <p className={styles.mutedText}>{formatCapacity(session)} seats booked</p>
                    </div>
                  </div>
                </td>
                <td className={styles.mutedText}>{session.guideName}</td>
                <td>{formatDateTime(session.startDateTime)}</td>
                <td>
                  <p className={styles.identityName}>{formatCapacity(session)}</p>
                  <p className={styles.mutedText}>{session.capacity} capacity</p>
                </td>
                <td><AdminStatusBadge status={status} /></td>
                <td>
                  <div className={styles.actions}>
                    <button
                      className={`${styles.button} ${styles.buttonDanger}`}
                      type="button"
                      disabled={status === "CANCELLED"}
                      onClick={() => openCancelModal(session)}
                    >
                      {status === "CANCELLED" ? "Cancelled" : "Cancel session"}
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}

          {!loading && sessions.length === 0 && (
            <tr>
              <td className={styles.mutedText} colSpan={6}>
                No sessions match the selected filters.
              </td>
            </tr>
          )}
        </AdminDataTable>
        <AdminPagination
          page={page}
          size={pageSize}
          totalElements={totalSessions}
          totalPages={totalPages}
          loading={loading}
          onPageChange={setPage}
          onSizeChange={updatePageSize}
        />
      </section>

      {selectedSession && (
        <div className={styles.modalBackdrop} role="presentation" onMouseDown={closeCancelModal}>
          <div className={styles.modal} role="dialog" aria-modal="true" onMouseDown={(event) => event.stopPropagation()}>
            <div className={styles.modalHeader}>
              <div>
                <p className={styles.resultLabel}>Admin cancellation</p>
                <h2 className={styles.modalTitle}>Cancel session</h2>
                <p className={styles.pageSubtitle}>
                  {selectedSession.activityTitle} · {formatDateTime(selectedSession.startDateTime)}
                </p>
              </div>
              <button className={styles.iconButton} type="button" onClick={closeCancelModal} disabled={submitting}>
                X
              </button>
            </div>

            <label className={styles.fieldLabel} htmlFor="cancel-reason">
              Reason
            </label>
            <textarea
              id="cancel-reason"
              className={styles.textarea}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Guide suspended / safety issue / weather / admin decision"
              rows={4}
            />

            <p className={styles.modalHint}>
              V1 cancels pending bookings, flags paid bookings for refund review, and does not trigger Stripe refunds.
            </p>

            <label className={styles.checkboxRow}>
              <input
                type="checkbox"
                checked={notifyUsers}
                onChange={(event) => setNotifyUsers(event.target.checked)}
              />
              <span>Notify affected users</span>
            </label>

            <div className={styles.modalActions}>
              <button className={styles.button} type="button" onClick={closeCancelModal} disabled={submitting}>
                Keep session
              </button>
              <button
                className={`${styles.button} ${styles.buttonDanger}`}
                type="button"
                disabled={cancelDisabled}
                onClick={() => void submitCancel()}
              >
                {submitting ? "Cancelling..." : "Confirm cancellation"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

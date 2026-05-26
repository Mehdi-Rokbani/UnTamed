import { useEffect, useState } from "react";
import AdminDataTable from "../../components/admin/AdminDataTable";
import AdminStatusBadge, { type AdminStatus } from "../../components/admin/AdminStatusBadge";
import {
  getPendingAdminRefunds,
  processAdminRefund,
  type AdminRefundItem,
} from "../../api/admin.api";
import styles from "../../style/admin.module.css";

type RefundStatus = Extract<
  AdminStatus,
  "REFUND_PENDING" | "REFUND_FAILED" | "REFUNDED" | "PARTIALLY_REFUNDED" | "NOT_REFUNDABLE"
>;

function normalizeRefundStatus(status: string): RefundStatus {
  if (
    status === "REFUND_FAILED"
    || status === "REFUNDED"
    || status === "PARTIALLY_REFUNDED"
    || status === "NOT_REFUNDABLE"
  ) {
    return status;
  }
  return "REFUND_PENDING";
}

function formatDate(value?: string | null) {
  if (!value) return "Unknown date";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "TND",
    minimumFractionDigits: 2,
  }).format(value || 0);
}

export default function AdminRefundsPage() {
  const [refunds, setRefunds] = useState<AdminRefundItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [selectedRefund, setSelectedRefund] = useState<AdminRefundItem | null>(null);
  const [notifyUser, setNotifyUser] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);

  async function loadRefunds() {
    setLoading(true);
    try {
      const data = await getPendingAdminRefunds();
      setRefunds(data);
      setError(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not load pending refunds");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadRefunds();
  }, []);

  function canProcess(refund: AdminRefundItem) {
    return refund.refundStatus === "REFUND_PENDING" || refund.refundStatus === "REFUND_FAILED";
  }

  function closeModal() {
    if (processingId) return;
    setSelectedRefund(null);
    setNotifyUser(true);
  }

  async function confirmRefund() {
    if (!selectedRefund) return;

    setProcessingId(selectedRefund.bookingId);
    setError(null);
    setSuccess(null);

    try {
      const response = await processAdminRefund(selectedRefund.bookingId, notifyUser);
      setSuccess(response.message || (response.userNotified ? "Refund processed and user notified." : "Refund processed successfully"));
      setSelectedRefund(null);
      setNotifyUser(true);
      await loadRefunds();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Refund processing failed");
    } finally {
      setProcessingId(null);
    }
  }

  return (
    <>
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>Refunds Management</h1>
          <p className={styles.pageSubtitle}>
            Process Stripe refunds for paid bookings that were cancelled by an admin workflow.
          </p>
        </div>
      </div>

      {error && <p className={`${styles.notice} ${styles.noticeError}`}>{error}</p>}
      {success && <p className={`${styles.notice} ${styles.noticeSuccess}`}>{success}</p>}
      {loading && <p className={styles.pageSubtitle}>Loading pending refunds...</p>}

      <section className={styles.panel}>
        <div className={styles.panelHeader}>
          <div className={styles.toolbar}>
            <div>
              <h2 className={styles.panelTitle}>Pending refunds</h2>
              <p className={styles.panelSubtitle}>Refund-pending and failed refunds that need admin action.</p>
            </div>
            <button className={styles.button} type="button" onClick={() => void loadRefunds()} disabled={loading}>
              Refresh
            </button>
          </div>
        </div>

        <AdminDataTable columns={["User", "Activity", "Session date", "Amount", "Refund", "Status", "Actions"]}>
          {refunds.map((refund) => {
            const status = normalizeRefundStatus(refund.refundStatus);
            const busy = processingId === refund.bookingId;

            return (
              <tr key={refund.bookingId}>
                <td>
                  <div>
                    <p className={styles.identityName}>{refund.userName || "Unknown user"}</p>
                    <p className={styles.mutedText}>{refund.userEmail}</p>
                  </div>
                </td>
                <td>
                  <p className={styles.identityName}>{refund.activityTitle}</p>
                  {refund.cancelReason && <p className={styles.mutedText}>{refund.cancelReason}</p>}
                </td>
                <td>{formatDate(refund.sessionDate)}</td>
                <td>{formatMoney(refund.amount)}</td>
                <td>
                  {formatMoney(refund.refundAmount)}
                  <p className={styles.mutedText}>{refund.refundPercent}%</p>
                </td>
                <td><AdminStatusBadge status={status} /></td>
                <td>
                  <div className={styles.actions}>
                    {canProcess(refund) ? (
                      <button
                        className={`${styles.button} ${styles.buttonAccent}`}
                        type="button"
                        disabled={busy}
                        onClick={() => {
                          setNotifyUser(true);
                          setSelectedRefund(refund);
                        }}
                      >
                        {busy ? "Processing..." : "Process refund"}
                      </button>
                    ) : (
                      <AdminStatusBadge status="REFUNDED" />
                    )}
                  </div>
                </td>
              </tr>
            );
          })}

          {!loading && refunds.length === 0 && (
            <tr>
              <td className={styles.mutedText} colSpan={7}>
                No pending refunds need admin action.
              </td>
            </tr>
          )}
        </AdminDataTable>
      </section>

      {selectedRefund && (
        <div className={styles.modalBackdrop} role="presentation" onMouseDown={closeModal}>
          <div className={styles.modal} role="dialog" aria-modal="true" onMouseDown={(event) => event.stopPropagation()}>
            <div className={styles.modalHeader}>
              <div>
                <p className={styles.resultLabel}>Stripe refund</p>
                <h2 className={styles.modalTitle}>Process refund</h2>
                <p className={styles.pageSubtitle}>
                  {selectedRefund.activityTitle} · {selectedRefund.userEmail}
                </p>
              </div>
              <button className={styles.iconButton} type="button" onClick={closeModal} disabled={Boolean(processingId)}>
                X
              </button>
            </div>

            <div className={styles.resultGrid}>
              <div className={styles.resultItem}>
                <span>Paid amount</span>
                <strong>{formatMoney(selectedRefund.amount)}</strong>
              </div>
              <div className={styles.resultItem}>
                <span>Refund amount</span>
                <strong>{formatMoney(selectedRefund.refundAmount)}</strong>
              </div>
            </div>

            <p className={styles.modalHint}>
              This will call Stripe once for this booking. Already-refunded bookings are treated safely by the backend.
            </p>

            <label className={styles.checkboxRow}>
              <input
                type="checkbox"
                checked={notifyUser}
                onChange={(event) => setNotifyUser(event.target.checked)}
              />
              <span>Notify user after refund</span>
            </label>

            <div className={styles.modalActions}>
              <button className={styles.button} type="button" onClick={closeModal} disabled={Boolean(processingId)}>
                Not now
              </button>
              <button
                className={`${styles.button} ${styles.buttonAccent}`}
                type="button"
                disabled={Boolean(processingId)}
                onClick={() => void confirmRefund()}
              >
                {processingId ? "Processing..." : "Confirm refund"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

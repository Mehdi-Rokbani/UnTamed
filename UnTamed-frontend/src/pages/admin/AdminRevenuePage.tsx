import { useEffect, useMemo, useState } from "react";
import AdminDataTable from "../../components/admin/AdminDataTable";
import AdminStatusBadge, { type AdminStatus } from "../../components/admin/AdminStatusBadge";
import {
  getAdminPayouts,
  getAdminRevenueRecords,
  getAdminRevenueSummary,
  markPayoutPaid,
  runWeeklyPayouts,
  type AdminRevenueSummary,
  type PayoutBatch,
  type RevenueRecord,
} from "../../api/admin.api";
import { formatTndMinor } from "../../utils/money";
import styles from "../../style/admin.module.css";

function formatDate(value?: string | null) {
  if (!value) return "Not set";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not set";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function status(value?: string | null): AdminStatus {
  const known = new Set<string>([
    "PENDING_SESSION_COMPLETION",
    "READY_FOR_PAYOUT",
    "PAYOUT_SCHEDULED",
    "PAID",
    "VOIDED",
    "CREATED",
    "FAILED",
  ]);
  return (known.has(value ?? "") ? value : "PENDING") as AdminStatus;
}

function summaryCards(summary: AdminRevenueSummary) {
  return [
    ["Gross booking revenue", formatTndMinor(summary.totalGrossMinor), `${summary.totalRevenueRecords} paid records`],
    ["Platform commission", formatTndMinor(summary.totalPlatformCommissionMinor), "10% of paid bookings"],
    ["Guide payouts", formatTndMinor(summary.totalGuidePayoutMinor), "90% guide share"],
    ["Ready payout", formatTndMinor(summary.readyPayoutMinor), `${summary.readyRecords} ready records`],
    ["Scheduled payout", formatTndMinor(summary.scheduledPayoutMinor), `${summary.scheduledRecords} batched records`],
    ["Paid payout", formatTndMinor(summary.paidPayoutMinor), `${summary.paidRecords} paid records`],
  ];
}

export default function AdminRevenuePage() {
  const [summary, setSummary] = useState<AdminRevenueSummary | null>(null);
  const [records, setRecords] = useState<RevenueRecord[]>([]);
  const [payouts, setPayouts] = useState<PayoutBatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [runningPayouts, setRunningPayouts] = useState(false);

  async function loadRevenue() {
    setLoading(true);
    try {
      const [summaryData, recordData, payoutData] = await Promise.all([
        getAdminRevenueSummary(),
        getAdminRevenueRecords(),
        getAdminPayouts(),
      ]);
      setSummary(summaryData);
      setRecords(recordData);
      setPayouts(payoutData);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load revenue data");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadRevenue();
  }, []);

  const cards = useMemo(() => (summary ? summaryCards(summary) : []), [summary]);

  async function handleMarkPaid(batchId: string) {
    setBusyId(batchId);
    setError(null);
    setSuccess(null);
    try {
      await markPayoutPaid(batchId);
      setSuccess("Payout batch marked as paid.");
      await loadRevenue();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not mark payout as paid");
    } finally {
      setBusyId(null);
    }
  }

  async function handleRunWeeklyPayouts() {
    setRunningPayouts(true);
    setError(null);
    setSuccess(null);
    try {
      const result = await runWeeklyPayouts();
      setSuccess(
        result.createdBatches === 0
          ? "No ready revenue records to batch."
          : `Created ${result.createdBatches} payout batch${result.createdBatches === 1 ? "" : "es"} for ${result.scheduledRecords} record${result.scheduledRecords === 1 ? "" : "s"}.`
      );
      await loadRevenue();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not run weekly payouts");
    } finally {
      setRunningPayouts(false);
    }
  }

  return (
    <>
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>Revenue and payouts</h1>
          <p className={styles.pageSubtitle}>Audit platform commission, guide earnings, and weekly payout batches.</p>
        </div>
        <div className={styles.headerActions}>
          <button
            className={`${styles.button} ${styles.buttonAccent}`}
            type="button"
            onClick={() => void handleRunWeeklyPayouts()}
            disabled={loading || runningPayouts}
          >
            {runningPayouts ? "Running..." : "Run weekly payout"}
          </button>
          <button className={styles.button} type="button" onClick={() => void loadRevenue()} disabled={loading || runningPayouts}>
            {loading ? "Refreshing..." : "Refresh"}
          </button>
        </div>
      </div>

      {error && <p className={`${styles.notice} ${styles.noticeError}`}>{error}</p>}
      {success && <p className={`${styles.notice} ${styles.noticeSuccess}`}>{success}</p>}
      {loading && <p className={styles.pageSubtitle}>Loading revenue ledger...</p>}

      {summary && (
        <section className={styles.statsGrid}>
          {cards.map(([label, value, helper]) => (
            <article className={styles.statsCard} key={label}>
              <div className={styles.statsTop}>
                <div>
                  <p className={styles.statsLabel}>{label}</p>
                  <p className={styles.statsValue}>{value}</p>
                </div>
              </div>
              <p className={styles.statsHelper}>{helper}</p>
            </article>
          ))}
        </section>
      )}

      <section className={styles.panel}>
        <div className={styles.panelHeader}>
          <div>
            <h2 className={styles.panelTitle}>Payout batches</h2>
            <p className={styles.panelSubtitle}>Weekly batches grouped by guide and currency.</p>
          </div>
        </div>

        <AdminDataTable columns={["Guide", "Period", "Bookings", "Gross", "Commission", "Payout", "Status", "Actions"]}>
          {payouts.map((batch) => (
            <tr key={batch.id}>
              <td>
                <p className={styles.identityName}>{batch.guideName || "Unknown guide"}</p>
                <p className={styles.mutedText}>{batch.guideEmail || batch.guideId}</p>
              </td>
              <td>
                {formatDate(batch.periodStart)} - {formatDate(batch.periodEnd)}
                {batch.paidAt && <p className={styles.mutedText}>Paid {formatDate(batch.paidAt)}</p>}
              </td>
              <td>{batch.totalBookings}</td>
              <td>{formatTndMinor(batch.totalGrossMinor)}</td>
              <td>{formatTndMinor(batch.totalCommissionMinor)}</td>
              <td>{formatTndMinor(batch.totalPayoutMinor)}</td>
              <td><AdminStatusBadge status={status(batch.status)} /></td>
              <td>
                {batch.status === "PAID" ? (
                  <span className={styles.mutedText}>Complete</span>
                ) : (
                  <button
                    className={`${styles.button} ${styles.buttonAccent}`}
                    type="button"
                    disabled={busyId === batch.id}
                    onClick={() => void handleMarkPaid(batch.id)}
                  >
                    {busyId === batch.id ? "Saving..." : "Mark paid"}
                  </button>
                )}
              </td>
            </tr>
          ))}
          {!loading && payouts.length === 0 && (
            <tr><td className={styles.mutedText} colSpan={8}>No payout batches yet.</td></tr>
          )}
        </AdminDataTable>
      </section>

      <section className={styles.panel}>
        <div className={styles.panelHeader}>
          <div>
            <h2 className={styles.panelTitle}>Revenue records</h2>
            <p className={styles.panelSubtitle}>One idempotent ledger record per paid booking.</p>
          </div>
        </div>

        <AdminDataTable columns={["Booking", "Guide", "Gross", "Commission", "Payout", "Status"]}>
          {records.map((record) => (
            <tr key={record.id}>
              <td>
                <p className={styles.identityName}>{record.activityTitle || record.bookingId}</p>
                <p className={styles.mutedText}>{formatDate(record.bookingDate)} · {record.sessionId}</p>
              </td>
              <td>
                <p className={styles.identityName}>{record.guideName || "Unknown guide"}</p>
                <p className={styles.mutedText}>{record.guideEmail || record.guideId}</p>
              </td>
              <td>{formatTndMinor(record.grossAmountMinor)}</td>
              <td>{formatTndMinor(record.platformCommissionMinor)}</td>
              <td>{formatTndMinor(record.guidePayoutMinor)}</td>
              <td><AdminStatusBadge status={status(record.status)} /></td>
            </tr>
          ))}
          {!loading && records.length === 0 && (
            <tr><td className={styles.mutedText} colSpan={6}>No revenue records yet.</td></tr>
          )}
        </AdminDataTable>
      </section>
    </>
  );
}

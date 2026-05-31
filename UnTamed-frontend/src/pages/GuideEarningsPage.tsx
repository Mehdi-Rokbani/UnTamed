import { useEffect, useMemo, useState } from "react";
import {
  getGuideEarningsSummary,
  getGuidePayouts,
  getGuideRevenueRecords,
  type GuideEarningsSummary,
  type GuidePayoutBatch,
  type GuideRevenueRecord,
} from "../api/guide.api";
import { formatTndMinor } from "../utils/money";
import guideStyles from "../style/guideActivities.module.css";
import adminStyles from "../style/admin.module.css";

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

function friendlyStatus(value?: string | null) {
  return (value || "UNKNOWN").replaceAll("_", " ");
}

function cards(summary: GuideEarningsSummary) {
  return [
    ["Gross bookings", formatTndMinor(summary.grossCompletedBookingAmountMinor)],
    ["Platform commission", formatTndMinor(summary.platformCommissionMinor)],
    ["Guide earnings", formatTndMinor(summary.guideEarningsMinor)],
    ["Pending payout", formatTndMinor(summary.pendingPayoutMinor)],
    ["Scheduled payout", formatTndMinor(summary.scheduledPayoutMinor)],
    ["Paid payout", formatTndMinor(summary.paidPayoutMinor)],
  ];
}

export default function GuideEarningsPage() {
  const [summary, setSummary] = useState<GuideEarningsSummary | null>(null);
  const [records, setRecords] = useState<GuideRevenueRecord[]>([]);
  const [payouts, setPayouts] = useState<GuidePayoutBatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadEarnings() {
    setLoading(true);
    try {
      const [summaryData, recordData, payoutData] = await Promise.all([
        getGuideEarningsSummary(),
        getGuideRevenueRecords(),
        getGuidePayouts(),
      ]);
      setSummary(summaryData);
      setRecords(recordData);
      setPayouts(payoutData);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load earnings");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadEarnings();
  }, []);

  const statCards = useMemo(() => (summary ? cards(summary) : []), [summary]);

  return (
    <div className={guideStyles.shell}>
      <div className={guideStyles.topBar}>
        <div>
          <h1 className={guideStyles.pageTitle}>Earnings and payouts</h1>
          <p className={guideStyles.pageSub}>Track completed booking revenue, platform commission, and weekly payout batches.</p>
        </div>
        <button className={guideStyles.btnRefresh} type="button" onClick={() => void loadEarnings()} disabled={loading}>
          {loading ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      {error && <p className={`${adminStyles.notice} ${adminStyles.noticeError}`}>{error}</p>}
      {loading && <div className={guideStyles.loadingState}><span className={guideStyles.spinner} /> Loading earnings...</div>}

      {summary && (
        <section className={guideStyles.statsRow}>
          {statCards.map(([label, value]) => (
            <article className={guideStyles.statCard} key={label}>
              <span className={guideStyles.statValue}>{value}</span>
              <span className={guideStyles.statLabel}>{label}</span>
            </article>
          ))}
        </section>
      )}

      <section className={adminStyles.panel}>
        <div className={adminStyles.panelHeader}>
          <div>
            <h2 className={adminStyles.panelTitle}>Revenue records</h2>
            <p className={adminStyles.panelSubtitle}>Paid completed bookings become payable after the session is completed.</p>
          </div>
        </div>
        <div className={adminStyles.tableWrap}>
          <table className={adminStyles.table}>
            <thead>
              <tr>
                <th>Session/activity</th>
                <th>Booking date</th>
                <th>Gross</th>
                <th>Commission</th>
                <th>Guide payout</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {records.map((record) => (
                <tr key={record.id}>
                  <td>
                    <p className={adminStyles.identityName}>{record.activityTitle || record.sessionId}</p>
                    <p className={adminStyles.mutedText}>{formatDate(record.sessionStartAt)}</p>
                  </td>
                  <td>{formatDate(record.bookingDate)}</td>
                  <td>{formatTndMinor(record.grossAmountMinor)}</td>
                  <td>{formatTndMinor(record.platformCommissionMinor)}</td>
                  <td>{formatTndMinor(record.guidePayoutMinor)}</td>
                  <td>{friendlyStatus(record.status)}</td>
                </tr>
              ))}
              {!loading && records.length === 0 && (
                <tr><td className={adminStyles.mutedText} colSpan={6}>No revenue records yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className={adminStyles.panel}>
        <div className={adminStyles.panelHeader}>
          <div>
            <h2 className={adminStyles.panelTitle}>Payout batches</h2>
            <p className={adminStyles.panelSubtitle}>Weekly payout batches created from eligible completed sessions.</p>
          </div>
        </div>
        <div className={adminStyles.tableWrap}>
          <table className={adminStyles.table}>
            <thead>
              <tr>
                <th>Payout period</th>
                <th>Total bookings</th>
                <th>Total payout</th>
                <th>Status</th>
                <th>Paid date</th>
              </tr>
            </thead>
            <tbody>
              {payouts.map((batch) => (
                <tr key={batch.id}>
                  <td>{formatDate(batch.periodStart)} - {formatDate(batch.periodEnd)}</td>
                  <td>{batch.totalBookings}</td>
                  <td>{formatTndMinor(batch.totalPayoutMinor)}</td>
                  <td>{friendlyStatus(batch.status)}</td>
                  <td>{formatDate(batch.paidAt)}</td>
                </tr>
              ))}
              {!loading && payouts.length === 0 && (
                <tr><td className={adminStyles.mutedText} colSpan={5}>No payout batches yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

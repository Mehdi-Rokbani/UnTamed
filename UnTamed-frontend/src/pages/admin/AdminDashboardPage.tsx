import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  AlertTriangle,
  BadgeCheck,
  CalendarClock,
  Compass,
  FileWarning,
  Leaf,
  Mountain,
  RefreshCw,
  ShieldCheck,
  Users,
  WalletCards,
} from "lucide-react";
import { getAdminAlerts, getAdminOverview, type AdminOverview } from "../../api/admin.api";
import styles from "../../style/admin.module.css";

type StatTone = "emerald" | "sky" | "amber" | "rose";

type StatCard = {
  label: string;
  value: string;
  helper: string;
  tone: StatTone;
  icon: ReactNode;
};

const chartColors = ["#2fb889", "#58a6ff", "#f0b35a", "#e8755b"];

function formatNumber(value?: number | null) {
  return new Intl.NumberFormat("en-US").format(Number.isFinite(value) ? Number(value) : 0);
}

function formatMoney(value?: number | null) {
  return `${new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(Number.isFinite(value) ? Number(value) : 0)} TND`;
}

function formatDate(value?: string | null) {
  if (!value) return "Unknown";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(date);
}

function formatLabel(value?: string | null) {
  if (!value) return "Unknown";
  return value.replaceAll("_", " ").toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function shortName(value?: string | null) {
  if (!value) return "Unknown";
  return value.split("@")[0]?.replace(/[._-]+/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase()) || value;
}

function buildStats(overview: AdminOverview): StatCard[] {
  return [
    {
      label: "Total users",
      value: formatNumber(overview.stats.totalUsers),
      helper: `${formatNumber(overview.stats.totalAdventurers)} adventurers`,
      tone: "emerald",
      icon: <Users size={18} />,
    },
    {
      label: "Guides",
      value: formatNumber(overview.stats.totalGuides),
      helper: `${formatNumber(overview.stats.pendingGuides)} awaiting verification`,
      tone: "sky",
      icon: <BadgeCheck size={18} />,
    },
    {
      label: "Activities",
      value: formatNumber(overview.stats.totalActivities),
      helper: `${formatNumber(overview.stats.totalSessions)} sessions scheduled`,
      tone: "amber",
      icon: <Compass size={18} />,
    },
    {
      label: "Bookings",
      value: formatNumber(overview.stats.totalBookings),
      helper: `${formatNumber(overview.stats.completedBookings)} completed`,
      tone: "emerald",
      icon: <CalendarClock size={18} />,
    },
    {
      label: "Open reports",
      value: formatNumber(overview.stats.openAlerts),
      helper: "Operational alerts from backend",
      tone: overview.stats.openAlerts > 0 ? "rose" : "emerald",
      icon: <FileWarning size={18} />,
    },
    {
      label: "Guide verification",
      value: formatNumber(overview.stats.pendingGuides),
      helper: "Verified badge workload",
      tone: overview.stats.pendingGuides > 0 ? "amber" : "emerald",
      icon: <ShieldCheck size={18} />,
    },
    {
      label: "Refund risk",
      value: formatNumber(overview.stats.pendingRefunds + overview.stats.failedRefunds),
      helper: `${formatNumber(overview.stats.failedRefunds)} failed refunds`,
      tone: overview.stats.failedRefunds > 0 ? "rose" : "amber",
      icon: <WalletCards size={18} />,
    },
    {
      label: "Revenue",
      value: formatMoney(overview.stats.totalRevenue),
      helper: "Succeeded payment attempts",
      tone: "sky",
      icon: <Leaf size={18} />,
    },
  ];
}

function trendData(overview: AdminOverview) {
  return overview.trends.map((bucket) => ({
    label: formatDate(bucket.date),
    bookings: bucket.newBookings,
    revenue: Math.round(bucket.revenue),
    users: bucket.newUsers,
  }));
}

function userDistribution(overview: AdminOverview) {
  const admins = Math.max(0, overview.stats.totalUsers - overview.stats.totalAdventurers - overview.stats.totalGuides);
  return [
    { name: "Adventurers", value: overview.stats.totalAdventurers },
    { name: "Guides", value: overview.stats.totalGuides },
    { name: "Admins", value: admins },
  ].filter((item) => item.value > 0);
}

function attentionItems(overview: AdminOverview) {
  return overview.moderationPriorities.filter((item) => item.count > 0).slice(0, 5);
}

function openWorkCount(overview: AdminOverview) {
  return overview.stats.openAlerts
    + overview.stats.pendingGuides
    + overview.stats.pendingRefunds
    + overview.stats.failedRefunds
    + overview.stats.cancelledSessions;
}

function Stat({ card }: { card: StatCard }) {
  return (
    <article className={`${styles.modernStatCard} ${styles[`modernStat${card.tone}`]}`}>
      <div className={styles.modernStatIcon}>{card.icon}</div>
      <div>
        <p>{card.label}</p>
        <strong>{card.value}</strong>
        <span>{card.helper}</span>
      </div>
    </article>
  );
}

function ChartCard({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return (
    <article className={styles.modernCard}>
      <div className={styles.modernCardHeader}>
        <div>
          <h2>{title}</h2>
          <p>{subtitle}</p>
        </div>
      </div>
      <div className={styles.modernChart}>{children}</div>
    </article>
  );
}

function Empty({ children }: { children: ReactNode }) {
  return <p className={styles.modernEmpty}>{children}</p>;
}

function QuickAction({
  to,
  label,
  value,
  helper,
  icon,
}: {
  to: string;
  label: string;
  value: string;
  helper: string;
  icon: ReactNode;
}) {
  return (
    <Link className={styles.modernQuickAction} to={to}>
      <span>{icon}</span>
      <div>
        <strong>{label}</strong>
        <p>{value}</p>
        <small>{helper}</small>
      </div>
    </Link>
  );
}

export default function AdminDashboardPage() {
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [openAlertCount, setOpenAlertCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadOverview() {
    setLoading(true);
    try {
      const [data, alerts] = await Promise.all([
        getAdminOverview(),
        getAdminAlerts({ page: 0, size: 1, status: "OPEN" }),
      ]);
      setOverview(data);
      setOpenAlertCount(alerts.totalElements);
      setError(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not load admin overview");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadOverview();
  }, []);

  const stats = useMemo(() => (overview ? buildStats(overview) : []), [overview]);
  const trends = useMemo(() => (overview ? trendData(overview) : []), [overview]);
  const distribution = useMemo(() => (overview ? userDistribution(overview) : []), [overview]);
  const priorities = useMemo(() => (overview ? attentionItems(overview) : []), [overview]);
  const openWork = useMemo(() => (overview ? openWorkCount(overview) : 0), [overview]);

  if (loading && !overview) {
    return (
      <section className={styles.modernState}>
        <div />
        <h1>Preparing admin overview</h1>
        <p>Loading marketplace health, moderation queues, and operational reports.</p>
      </section>
    );
  }

  if (error && !overview) {
    return (
      <section className={styles.modernState}>
        <AlertTriangle size={32} />
        <h1>Dashboard unavailable</h1>
        <p>{error}</p>
        <button className={styles.button} type="button" onClick={() => void loadOverview()}>
          Retry
        </button>
      </section>
    );
  }

  if (!overview) {
    return (
      <section className={styles.modernState}>
        <h1>No overview data</h1>
        <p>The admin overview API returned an empty snapshot.</p>
      </section>
    );
  }

  return (
    <div className={styles.modernDashboard}>
      <section className={styles.modernHero}>
        <div>
          <p>Untamed operations studio</p>
          <h1>Marketplace overview</h1>
          <span>Track bookings, revenue, guide verification, moderation signals, and platform health from one calm workspace.</span>
          <div className={styles.modernHeroMetrics}>
            <span><strong>{formatMoney(overview.stats.totalRevenue)}</strong> revenue</span>
            <span><strong>{formatNumber(overview.stats.totalBookings)}</strong> bookings</span>
            <span><strong>{formatNumber(openWork)}</strong> open work items</span>
          </div>
        </div>
        <div className={styles.modernHeroActions}>
          {openAlertCount > 0 && <Link to="/admin/alerts?status=OPEN">{formatNumber(openAlertCount)} open reports</Link>}
          <button className={styles.button} type="button" onClick={() => void loadOverview()} disabled={loading}>
            <RefreshCw size={16} />
            {loading ? "Refreshing" : "Refresh"}
          </button>
        </div>
      </section>

      {error && (
        <div className={`${styles.notice} ${styles.noticeError}`}>
          <span>{error}</span>
          <button className={styles.button} type="button" onClick={() => void loadOverview()}>
            Retry
          </button>
        </div>
      )}

      <section className={styles.modernStatsGrid}>
        {stats.map((card) => (
          <Stat card={card} key={card.label} />
        ))}
      </section>

      <section className={styles.modernCommandGrid} aria-label="Priority admin actions">
        <QuickAction
          to="/admin/guides?status=PENDING_VERIFICATION"
          label="Verify guides"
          value={formatNumber(overview.stats.pendingGuides)}
          helper="profiles awaiting badge review"
          icon={<ShieldCheck size={18} />}
        />
        <QuickAction
          to="/admin/alerts?status=OPEN"
          label="Review reports"
          value={formatNumber(overview.stats.openAlerts)}
          helper="open operational alerts"
          icon={<FileWarning size={18} />}
        />
        <QuickAction
          to="/admin/sessions?status=CANCELLED"
          label="Session health"
          value={formatNumber(overview.stats.cancelledSessions)}
          helper="cancelled sessions to inspect"
          icon={<CalendarClock size={18} />}
        />
        <QuickAction
          to="/admin/activities"
          label="Adventure catalog"
          value={formatNumber(overview.stats.totalActivities)}
          helper="activities across the platform"
          icon={<Mountain size={18} />}
        />
      </section>

      <section className={styles.modernMainGrid}>
        <ChartCard title="Booking and revenue evolution" subtitle="Seven-day trend from the admin overview API">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={trends} margin={{ top: 12, right: 14, left: -18, bottom: 0 }}>
              <defs>
                <linearGradient id="adminBookingFill" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor="#2fb889" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="#2fb889" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="rgba(48,67,57,0.1)" vertical={false} />
              <XAxis dataKey="label" tick={{ fill: "#7a857d", fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "#7a857d", fontSize: 12 }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ background: "#ffffff", border: "1px solid #e4e9df", borderRadius: 14, color: "#1c3126", boxShadow: "0 18px 40px rgba(36, 52, 42, 0.14)" }} />
              <Legend />
              <Area type="monotone" dataKey="bookings" name="New bookings" stroke="#2fb889" strokeWidth={3} fill="url(#adminBookingFill)" />
              <Line type="monotone" dataKey="revenue" name="Revenue" stroke="#f0b35a" strokeWidth={3} dot={false} />
              <Line type="monotone" dataKey="users" name="New users" stroke="#58a6ff" strokeWidth={2} dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="User distribution" subtitle="Adventurers, guides, and admins from live account counts">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={distribution} dataKey="value" nameKey="name" innerRadius="58%" outerRadius="82%" paddingAngle={4}>
                {distribution.map((item, index) => (
                  <Cell fill={chartColors[index % chartColors.length]} key={item.name} />
                ))}
              </Pie>
              <Tooltip contentStyle={{ background: "#ffffff", border: "1px solid #e4e9df", borderRadius: 14, color: "#1c3126", boxShadow: "0 18px 40px rgba(36, 52, 42, 0.14)" }} />
              <Legend iconType="circle" />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>
      </section>

      <section className={styles.modernSecondaryGrid}>
        <ChartCard title="Reports by status" subtitle="Operational alert status, not user-submitted report claims">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={overview.alertStatusBuckets} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid stroke="rgba(48,67,57,0.1)" vertical={false} />
              <XAxis dataKey="status" tick={{ fill: "#7a857d", fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "#7a857d", fontSize: 12 }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ background: "#ffffff", border: "1px solid #e4e9df", borderRadius: 14, color: "#1c3126", boxShadow: "0 18px 40px rgba(36, 52, 42, 0.14)" }} />
              <Bar dataKey="count" name="Reports" fill="#2fb889" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <article className={styles.modernCard}>
          <div className={styles.modernCardHeader}>
            <div>
              <h2>Needs attention</h2>
              <p>Backend-ranked moderation and operations queues.</p>
            </div>
            <Link to="/admin/alerts?status=OPEN">Open reports</Link>
          </div>
          {priorities.length > 0 ? (
            <div className={styles.modernAttentionList}>
              {priorities.map((priority) => (
                <Link to={priority.route} key={priority.key}>
                  <div>
                    <strong>{priority.label}</strong>
                    <span>{priority.description}</span>
                  </div>
                  <em>{formatNumber(priority.count)}</em>
                </Link>
              ))}
            </div>
          ) : (
            <Empty>No moderation queues currently need attention.</Empty>
          )}
        </article>

        <article className={styles.modernCard}>
          <div className={styles.modernCardHeader}>
            <div>
              <h2>Recent activity templates</h2>
              <p>Newest guide-created adventures.</p>
            </div>
            <Link to="/admin/activities">View all</Link>
          </div>
          <div className={styles.modernMediaList}>
            {overview.recentActivities.map((activity) => (
              <Link to="/admin/activities" key={activity.id}>
                <span className={styles.modernThumb}>
                  {activity.coverImageUrl ? <img src={activity.coverImageUrl} alt="" /> : <Compass size={17} />}
                </span>
                <div>
                  <strong>{activity.title}</strong>
                  <small>{activity.guideName}</small>
                </div>
                <em>{formatLabel(activity.status)}</em>
              </Link>
            ))}
            {overview.recentActivities.length === 0 && <Empty>No recent activities.</Empty>}
          </div>
        </article>
      </section>

      <section className={styles.modernListsGrid}>
        <article className={styles.modernCard}>
          <div className={styles.modernCardHeader}>
            <div>
              <h2>Guide verification</h2>
              <p>Unverified guide profiles waiting for badge review.</p>
            </div>
            <Link to="/admin/guides?status=PENDING_VERIFICATION">Review</Link>
          </div>
          <div className={styles.modernCompactList}>
            {overview.pendingGuides.map((guide) => (
              <Link to="/admin/guides?status=PENDING_VERIFICATION" key={guide.id}>
                <strong>{guide.username || guide.email}</strong>
                <span>{guide.email}</span>
                <em>Unverified</em>
              </Link>
            ))}
            {overview.pendingGuides.length === 0 && <Empty>No guides are waiting for verification.</Empty>}
          </div>
        </article>

        <article className={styles.modernCard}>
          <div className={styles.modernCardHeader}>
            <div>
              <h2>Refund and session risk</h2>
              <p>Requests and cancellations that may need admin action.</p>
            </div>
            <Link to="/admin/refunds">Refunds</Link>
          </div>
          <div className={styles.modernCompactList}>
            {overview.refundAlerts.map((refund) => (
              <Link to="/admin/refunds" key={refund.bookingId}>
                <strong>{refund.activityTitle || "Refund request"}</strong>
                <span>{refund.userEmail}</span>
                <em>{formatMoney(refund.refundAmount)}</em>
              </Link>
            ))}
            {overview.refundAlerts.length === 0 && overview.sessionAlerts.length === 0 && <Empty>No refund or session risk in this snapshot.</Empty>}
            {overview.sessionAlerts.map((session) => (
              <Link to="/admin/sessions?status=CANCELLED" key={session.sessionId}>
                <strong>{session.activityTitle}</strong>
                <span>{session.guideName}</span>
                <em>Cancelled</em>
              </Link>
            ))}
          </div>
        </article>

        <article className={styles.modernCard}>
          <div className={styles.modernCardHeader}>
            <div>
              <h2>Recent admin actions</h2>
              <p>Latest sensitive moderation events.</p>
            </div>
            <Link to="/admin/audit-logs">Audit logs</Link>
          </div>
          <div className={styles.modernCompactList}>
            {overview.recentAuditLogs.map((log) => (
              <Link to="/admin/audit-logs" key={log.id}>
                <strong>{formatLabel(log.action)}</strong>
                <span>{log.targetLabel || "Untitled target"}</span>
                <em>{shortName(log.adminEmail)}</em>
              </Link>
            ))}
            {overview.recentAuditLogs.length === 0 && <Empty>No audit events yet.</Empty>}
          </div>
        </article>
      </section>
    </div>
  );
}

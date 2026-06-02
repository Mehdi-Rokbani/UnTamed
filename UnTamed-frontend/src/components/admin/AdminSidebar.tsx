import { useEffect, useState } from "react";
import {
  Activity,
  BellDot,
  Flag,
  CalendarClock,
  Compass,
  LayoutDashboard,
  LogOut,
  ReceiptText,
  ScrollText,
  ShieldCheck,
  Users,
  WalletCards,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { NavLink, useNavigate } from "react-router-dom";
import { getAdminAlerts, getAdminOverview } from "../../api/admin.api";
import { useAuth } from "../../auth/auth.store";
import styles from "../../style/admin.module.css";

type BadgeKey = "alerts" | "reports" | "users" | "guides" | "refunds";

type SidebarLink = {
  to: string;
  label: string;
  icon: LucideIcon;
  end?: boolean;
  badgeKey?: BadgeKey;
};

const sections: Array<{ title: string; links: SidebarLink[] }> = [
  {
    title: "Main",
    links: [
      { to: "/admin", label: "Overview", icon: LayoutDashboard, end: true },
      { to: "/admin/users", label: "Users", icon: Users, badgeKey: "users" },
      { to: "/admin/guides", label: "Guide verification", icon: ShieldCheck, badgeKey: "guides" },
      { to: "/admin/activities", label: "Activities", icon: Activity },
    ],
  },
  {
    title: "Operations",
    links: [
      { to: "/admin/sessions", label: "Session management", icon: CalendarClock },
      { to: "/admin/refunds", label: "Refunds", icon: ReceiptText, badgeKey: "refunds" },
      { to: "/admin/revenue", label: "Revenue & payouts", icon: WalletCards },
      { to: "/admin/reports", label: "Reports & appeals", icon: Flag, badgeKey: "reports" },
      { to: "/admin/alerts", label: "Alerts", icon: BellDot, badgeKey: "alerts" },
    ],
  },
  {
    title: "System",
    links: [
      { to: "/admin/audit-logs", label: "Audit logs", icon: ScrollText },
    ],
  },
];

function initials(value?: string | null) {
  if (!value) return "AD";
  return value
    .split(/\s+|@/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "AD";
}

export default function AdminSidebar() {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const [badges, setBadges] = useState({ alerts: 0, reports: 0, users: 0, guides: 0, refunds: 0 });
  const displayName = user?.username || user?.email || "Administrator";

  async function loadSidebarStats() {
    try {
      const [overview, alerts] = await Promise.all([
        getAdminOverview(),
        getAdminAlerts({ page: 0, size: 1, status: "OPEN" }),
      ]);
      setBadges({
        alerts: alerts.totalElements,
        reports: overview.stats.pendingReports,
        users: overview.stats.totalUsers,
        guides: overview.stats.pendingGuides,
        refunds: overview.stats.pendingRefunds + overview.stats.failedRefunds,
      });
    } catch {
      setBadges({ alerts: 0, reports: 0, users: 0, guides: 0, refunds: 0 });
    }
  }

  useEffect(() => {
    const initialLoadId = window.setTimeout(() => {
      void loadSidebarStats();
    }, 0);
    const intervalId = window.setInterval(() => {
      void loadSidebarStats();
    }, 60000);

    return () => {
      window.clearTimeout(initialLoadId);
      window.clearInterval(intervalId);
    };
  }, []);

  async function handleSignOut() {
    await signOut();
    navigate("/login", { replace: true });
  }

  return (
    <aside className={styles.sidebar}>
      <div className={styles.previewBrand}>
        <div className={styles.previewBrandMark}>
          <Compass size={18} strokeWidth={2.4} />
        </div>
        <div>
          <h1>UnTamed</h1>
          <p>Admin analytics</p>
        </div>
      </div>

      <nav className={styles.previewNav} aria-label="Admin navigation">
        {sections.map((section) => (
          <div className={styles.previewNavSection} key={section.title}>
            <p>{section.title}</p>
            {section.links.map((link) => {
              const badge = link.badgeKey ? badges[link.badgeKey as keyof typeof badges] : 0;
              const Icon = link.icon;

              return (
                <NavLink
                  key={`${section.title}-${link.label}`}
                  to={link.to}
                  end={link.end}
                  className={({ isActive }) => `${styles.previewNavLink} ${isActive ? styles.previewNavLinkActive : ""}`}
                >
                  <span className={styles.previewNavIcon}>
                    <Icon size={15} strokeWidth={2.4} />
                  </span>
                  <span>{link.label}</span>
                  {badge > 0 && <strong>{badge > 99 ? "99+" : badge}</strong>}
                </NavLink>
              );
            })}
          </div>
        ))}
      </nav>

      <div className={styles.previewSidebarUser}>
        <span>{initials(displayName)}</span>
        <div>
          <strong>{displayName}</strong>
          <p>Administrator</p>
        </div>
        <button
          className={styles.previewSidebarLogout}
          type="button"
          onClick={() => void handleSignOut()}
          aria-label="Sign out"
          title="Sign out"
        >
          <LogOut size={16} strokeWidth={2.3} />
        </button>
      </div>
    </aside>
  );
}

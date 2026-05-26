import { useLocation } from "react-router-dom";
import { useAuth } from "../../auth/auth.store";
import styles from "../../style/admin.module.css";

function initials(name: string) {
  return name
    .split(/\s+|@/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "AD";
}

function todayLabel() {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(new Date());
}

function pageTitle(pathname: string) {
  if (pathname.includes("/admin/users")) return "Users";
  if (pathname.includes("/admin/guides")) return "Guide verification";
  if (pathname.includes("/admin/activities")) return "Activity moderation";
  if (pathname.includes("/admin/sessions")) return "Session management";
  if (pathname.includes("/admin/refunds")) return "Refunds";
  if (pathname.includes("/admin/alerts")) return "Reports & alerts";
  if (pathname.includes("/admin/audit-logs")) return "Moderation logs";
  return "Overview";
}

export default function AdminTopbar() {
  const { user } = useAuth();
  const location = useLocation();
  const displayName = user?.username || user?.email || "Admin";

  return (
    <header className={styles.topbar}>
      <div className={styles.previewTopbarTitle}>
        <h1>{pageTitle(location.pathname)}</h1>
        <p>{todayLabel()}</p>
      </div>
      <div className={styles.previewTopbarActions}>
        <div className={styles.previewTopbarAvatar}>{initials(displayName)}</div>
      </div>
    </header>
  );
}

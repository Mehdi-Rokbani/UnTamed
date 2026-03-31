import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/auth.store";
import styles from "../style/guideSidebar.module.css";

function IconHome() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9.5L12 3l9 6.5V20a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9.5z"/>
      <path d="M9 21V12h6v9"/>
    </svg>
  );
}

function IconActivities() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2"/>
      <path d="M16 2v4M8 2v4M3 10h18"/>
      <path d="M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01"/>
    </svg>
  );
}

function IconCreate() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9"/>
      <path d="M12 8v8M8 12h8"/>
    </svg>
  );
}

function IconGuideProfile() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
      <circle cx="12" cy="7" r="4"/>
      <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
    </svg>
  );
}

function IconProfile() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="4"/>
      <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
    </svg>
  );
}

function IconLogout() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
      <polyline points="16 17 21 12 16 7"/>
      <line x1="21" y1="12" x2="9" y2="12"/>
    </svg>
  );
}

interface ItemProps {
  to: string;
  label: string;
  icon: React.ReactNode;
  end?: boolean;
}

function Item({ to, label, icon, end = false }: ItemProps) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        `${styles.navItem} ${isActive ? styles.navItemActive : ""}`
      }
    >
      <span className={styles.navIcon}>{icon}</span>
      <span className={styles.navLabel}>{label}</span>
    </NavLink>
  );
}

export default function GuideSidebar() {
  const nav = useNavigate();
  const { user, signOut } = useAuth();

  const displayName = user?.username ?? user?.email ?? "Guide";
  const initials = displayName.slice(0, 2).toUpperCase();
  const avatarUrl = (user as any)?.profileImageUrl ?? null;

  return (
    <aside className={styles.sidebar}>
      <div className={styles.bgGlow} />
      <div className={styles.bgGrain} />

      {/* Brand */}
      <div className={styles.brand}>
        <div className={styles.brandMark}>
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 17L12 3l9 14H3z"/>
            <path d="M9 17v-3h6v3"/>
          </svg>
        </div>
        <div className={styles.brandText}>
          <span className={styles.brandName}>UnTamed</span>
          <span className={styles.brandRole}>Guide Panel</span>
        </div>
      </div>

      {/* User pill */}
      <div className={styles.userPill}>
        <div className={styles.userAvatar}>
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt={displayName}
              className={styles.userAvatarImg}
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).style.display = "none";
                (e.currentTarget.nextSibling as HTMLElement).style.display = "flex";
              }}
            />
          ) : null}
          <span style={{ display: avatarUrl ? "none" : "flex" }}>{initials}</span>
        </div>
        <div className={styles.userInfo}>
          <span className={styles.userName}>{displayName}</span>
          <span className={styles.userBadge}>Guide</span>
        </div>
      </div>

      {/* Nav */}
      <nav className={styles.nav}>
        <div className={styles.navSection}>
          <span className={styles.sectionLabel}>Overview</span>
          <Item to="/home" label="Home" icon={<IconHome />} end />
        </div>

        <div className={styles.navSection}>
          <span className={styles.sectionLabel}>Activities</span>
          <Item to="/guide/activities" label="My Activities" icon={<IconActivities />} end />
          <Item to="/activities/create" label="New Activity" icon={<IconCreate />} end />
        </div>

        <div className={styles.navSection}>
          <span className={styles.sectionLabel}>Account</span>
          <Item to="/profile/guide/edit" label="Guide Profile" icon={<IconGuideProfile />} end />
          <Item to="/profile" label="My Profile" icon={<IconProfile />} end />
        </div>
      </nav>

      {/* Footer */}
      <div className={styles.footer}>
        <button
          type="button"
          className={styles.logoutBtn}
          onClick={async () => {
            await signOut();
            nav("/login", { replace: true });
          }}
        >
          <IconLogout />
          <span>Sign out</span>
        </button>
      </div>
    </aside>
  );
}
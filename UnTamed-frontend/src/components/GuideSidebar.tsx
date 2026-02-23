import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/auth.store";
import styles from "../style/guideSidebar.module.css";

function Item({ to, label, icon }: { to: string; label: string; icon: string }) {
  return (
    <NavLink to={to} className={({ isActive }) => `${styles.gsItem} ${isActive ? styles.active : ""}`} end>
      <span className={styles.gsIcon}>{icon}</span>
      <span className={styles.gsLabel}>{label}</span>
    </NavLink>
  );
}

export default function GuideSidebar() {
  const nav = useNavigate();
  const { user, signOut } = useAuth();

  return (
    <aside className={styles.gs}>
      <div className={styles.gsTop}>
        {/* Brand */}
        <div className={styles.gsBrand}>
          <div className={styles.gsLogo}>⛺</div>
          <div>
            <div className={styles.gsTitle}>Guide Panel</div>
            <div className={styles.gsSub}>{user?.username ?? user?.email ?? "Guide"}</div>
          </div>
        </div>

        {/* Navigation */}
        <nav className={styles.gsNav}>
          <div className={styles.gsNavSection}>
            <div className={styles.gsSectionLabel}>Explore</div>
            <Item to="/home" label="Home" icon="🏠" />
          </div>

          <div className={styles.gsNavSection}>
            <div className={styles.gsSectionLabel}>Activities</div>
            <Item to="/guide/activities" label="My Activities" icon="🗂️" />
            <Item to="/activities/create" label="Create Activity" icon="➕" />
          </div>

          <div className={styles.gsNavSection}>
            <div className={styles.gsSectionLabel}>Account</div>
            <Item to="/profile/guide/edit" label="Guide Profile" icon="🧑‍🏫" />
            <Item to="/profile" label="My Profile" icon="👤" />
          </div>
        </nav>
      </div>

      <div className={styles.gsBottom}>
        <button 
          type="button"
          className={styles.gsLogout}
          onClick={async () => {
            await signOut();
            nav("/login", { replace: true });
          }}
        >
          <span>🚪</span>
          <span>Logout</span>
        </button>
      </div>
    </aside>
  );
}
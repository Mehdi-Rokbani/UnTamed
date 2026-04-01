import { useState, useEffect, useRef, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import styles from "../style/header.module.css";
import { useAuth } from "../auth/auth.store";

export function Header() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const toggleMobileMenu = () => setMobileMenuOpen((v) => !v);
  const closeMobileMenu = () => setMobileMenuOpen(false);

  const handleLogout = async () => {
    await signOut();
    setDropdownOpen(false);
    closeMobileMenu();
    navigate("/login");
  };

  const profileImageUrl = user?.profileImageUrl ?? null;

  const displayName = useMemo(() => {
    if (!user) return "";
    return user.username?.trim() || user.email || "User";
  }, [user]);

  return (
    <header className={`${styles.header} ${scrolled ? styles.scrolled : ""}`}>
      <div className={styles.headerContainer}>

        {/* Logo → /home */}
        <Link to="/home" className={styles.headerBrand} onClick={closeMobileMenu}>
          <span className={styles.brandAccent}>Un</span>
          <span className={styles.brandText}>Tamed</span>
        </Link>

        {/* Empty nav — kept for mobile menu structure */}
        <nav className={`${styles.headerNav} ${mobileMenuOpen ? styles.active : ""}`}>

        </nav>

        {/* Actions */}
        <div className={styles.headerActions}>
          {!user ? (
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <Link to="/login" className={styles.headerLogin}>
                Log in
              </Link>
              <Link to="/register" className={styles.headerCta}>
                Get Started
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M6 12L10 8L6 4" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </Link>
            </div>
          ) : (
            <div className={styles.profileWrapper} ref={dropdownRef}>
              {/* Profile button — opens dropdown */}
              <button
                className={`${styles.profileButton} ${dropdownOpen ? styles.profileButtonActive : ""}`}
                onClick={() => setDropdownOpen((v) => !v)}
              >
                {profileImageUrl ? (
                  <img src={profileImageUrl} alt={displayName} className={styles.profileAvatar} />
                ) : (
                  <div className={styles.profileAvatarPlaceholder}>
                    {displayName.slice(0, 1).toUpperCase()}
                  </div>
                )}
                <span className={styles.profileName}>{displayName}</span>
                {user.role === "GUIDE" && user.verified && (
                  <svg className={styles.verifiedBadge} viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                )}
                {/* Chevron */}
                <svg
                  className={`${styles.chevron} ${dropdownOpen ? styles.chevronUp : ""}`}
                  width="14" height="14" viewBox="0 0 24 24"
                  fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"
                >
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </button>

              {/* Dropdown */}
              {dropdownOpen && (
                <div className={styles.dropdown}>
                  {/* User info header */}
                  <div className={styles.dropdownHeader}>
                    <div className={styles.dropdownAvatar}>
                      {profileImageUrl ? (
                        <img src={profileImageUrl} alt={displayName} />
                      ) : (
                        <span>{displayName.slice(0, 1).toUpperCase()}</span>
                      )}
                    </div>
                    <div>
                      <div className={styles.dropdownName}>{displayName}</div>
                      <div className={styles.dropdownRole}>{user.role}</div>
                    </div>
                  </div>

                  <div className={styles.dropdownDivider} />

                  {/* Menu items */}
                  <Link
                    to="/profile"
                    className={styles.dropdownItem}
                    onClick={() => setDropdownOpen(false)}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
                      <circle cx="12" cy="7" r="4" />
                    </svg>
                    Profile
                  </Link>

                  {user.role === "GUIDE" && (
                    <Link
                      to="/guide"
                      className={styles.dropdownItem}
                      onClick={() => setDropdownOpen(false)}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                        <rect x="3" y="3" width="7" height="7" />
                        <rect x="14" y="3" width="7" height="7" />
                        <rect x="14" y="14" width="7" height="7" />
                        <rect x="3" y="14" width="7" height="7" />
                      </svg>
                      Dashboard
                    </Link>
                  )}
                  <Link
                    to="/my-bookings"
                    className={styles.dropdownItem}
                    onClick={() => setDropdownOpen(false)}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M8 7V3m8 4V3M3 11h18M5 5h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2z" />
                    </svg>
                    My bookings
                  </Link>

                  <div className={styles.dropdownDivider} />

                  <button className={`${styles.dropdownItem} ${styles.dropdownLogout}`} onClick={handleLogout}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <path d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                    Logout
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Mobile toggle */}
        <button
          className={`${styles.mobileToggle} ${mobileMenuOpen ? styles.mobileToggleActive : ""}`}
          onClick={toggleMobileMenu}
          aria-label="Toggle menu"
        >
          <Link to="/my-bookings" className={styles.navLink} onClick={closeMobileMenu}>
            My bookings
          </Link>
          <span />
          <span />
          <span />
        </button>
      </div>
    </header>
  );
}
import { useState, useEffect, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import styles from "../style/header.module.css";
import { useAuth } from "../auth/auth.store";

export function Header() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const toggleMobileMenu = () => setMobileMenuOpen((v) => !v);
  const closeMobileMenu = () => setMobileMenuOpen(false);

  const handleLogout = async () => {
    await signOut();
    closeMobileMenu();
    navigate("/login");
  };

  const goToProfile = () => {
    closeMobileMenu();
    navigate("/profile");
  };

  const profileImageUrl = user?.profileImageUrl ?? null;

  const displayName = useMemo(() => {
    if (!user) return "";
    const username = user.username?.trim();
    return username || user.email || "User";
  }, [user]);

  return (
    <header className={`${styles.header} ${scrolled ? styles.scrolled : ""}`}>
      <div className={styles.headerContainer}>
        <Link to="/" className={styles.headerBrand} onClick={closeMobileMenu}>
          <span className={styles.brandAccent}>Un</span>
          <span className={styles.brandText}>Tamed</span>
        </Link>

        <nav className={`${styles.headerNav} ${mobileMenuOpen ? styles.active : ""}`}>
          <Link to="/home" className={styles.navLink} onClick={closeMobileMenu}>
            Home
          </Link>
          <Link to="/contact" className={styles.navLink} onClick={closeMobileMenu}>
            Contact
          </Link>
          <Link to="/blog" className={styles.navLink} onClick={closeMobileMenu}>
            Blog
          </Link>
          <Link to="/support" className={styles.navLink} onClick={closeMobileMenu}>
            Support
          </Link>
          <Link to="/about" className={styles.navLink} onClick={closeMobileMenu}>
            About
          </Link>

          {/* Mobile only items */}
          {user && (
            <>
              <Link to="/profile" className={`${styles.navLink} ${styles.mobileOnly}`} onClick={closeMobileMenu}>
                Profile
              </Link>
              <button className={`${styles.navLink} ${styles.mobileOnly} ${styles.mobileLogout}`} onClick={handleLogout}>
                Logout
              </button>
            </>
          )}
        </nav>

        <div className={styles.headerActions}>
          {!user ? (
            <Link to="/register" className={styles.headerCta}>
              Get Started
              <svg
                width="16"
                height="16"
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path
                  d="M6 12L10 8L6 4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </Link>
          ) : (
            <>
              <button className={styles.profileButton} onClick={goToProfile}>
                {profileImageUrl ? (
                  <img
                    src={profileImageUrl}
                    alt={displayName}
                    className={styles.profileAvatar}
                  />
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
              </button>

              <button className={styles.logoutButton} onClick={handleLogout}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
              </button>
            </>
          )}
        </div>

        <button
          className={`mobile-toggle ${mobileMenuOpen ? "active" : ""}`}
          onClick={toggleMobileMenu}
          aria-label="Toggle menu"
        >
          <span></span>
          <span></span>
          <span></span>
        </button>
      </div>
    </header>
  );
}
import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { verifyEmail, resendVerification } from "../api/auth.api";
import styles from "../style/verifyEmail.module.css";

type Status = "idle" | "loading" | "ok" | "error" | "missing";

export function VerifyEmailPage() {
  const loc = useLocation();
  const nav = useNavigate();

  const token = useMemo(() => {
    return new URLSearchParams(loc.search).get("token");
  }, [loc.search]);

  const [status, setStatus] = useState<Status>("idle");
  const [err, setErr] = useState<string | null>(null);
  const [loadingResend, setLoadingResend] = useState(false);

  const emailHint = useMemo(() => {
    return new URLSearchParams(loc.search).get("email");
  }, [loc.search]);

  useEffect(() => {
    (async () => {
      setErr(null);
      if (!token) {
        setStatus("missing");
        return;
      }
      setStatus("loading");
      try {
        await verifyEmail(token);
        setStatus("ok");
        // Auto-redirect after 2 seconds
        setTimeout(() => nav("/login", { replace: true }), 2000);
      } catch (e: any) {
        setStatus("error");
        setErr(e?.message ?? "Verification failed");
      }
    })();
  }, [token, nav]);

  async function onResend() {
    if (!emailHint) {
      setErr("No email provided. Please go to login and use resend verification there.");
      return;
    }
    setErr(null);
    setLoadingResend(true);
    try {
      await resendVerification(emailHint);
      setErr(null);
    } catch (e: any) {
      setErr(e?.message ?? "Could not resend verification email");
    } finally {
      setLoadingResend(false);
    }
  }

  return (
    <div className={styles.verifyEmailPage}>
      {/* Background gradient */}
      <div className={styles.verifyBgGradient} />

      {/* Decorative elements */}
      <div className={`${styles.verifyDecoration} ${styles.verifyDecoration1}`} />
      <div className={`${styles.verifyDecoration} ${styles.verifyDecoration2}`} />
      <div className={`${styles.verifyDecoration} ${styles.verifyDecoration3}`} />

      <div className={styles.verifyContainer}>
        {/* Logo/Brand */}
        <div className={styles.verifyBrand}>
          <div className={styles.verifyLogo}>
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 11l3 3L22 4" />
              <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />
            </svg>
          </div>
          <h1 className={styles.verifyBrandName}>UnTamed</h1>
        </div>

        {/* Card */}
        <div className={styles.verifyCard}>
          {/* Loading State */}
          {status === "loading" && (
            <div className={styles.verifyContent}>
              <div className={`${styles.verifyIconContainer} ${styles.loading}`}>
                <div className={styles.verifySpinner} />
              </div>
              <h2 className={styles.verifyHeading}>Verifying your email</h2>
              <p className={styles.verifyText}>Please wait while we confirm your email address...</p>
            </div>
          )}

          {/* Missing Token */}
          {status === "missing" && (
            <div className={styles.verifyContent}>
              <div className={`${styles.verifyIconContainer} ${styles.error}`}>
                <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
              </div>
              <h2 className={styles.verifyHeading}>Invalid verification link</h2>
              <p className={styles.verifyText}>
                The verification link is missing required information. Please check your email for the correct link.
              </p>
              <div className={styles.verifyActions}>
                <Link to="/login" className={`${styles.verifyBtn} ${styles.verifyBtnPrimary}`}>
                  Go to login
                </Link>
              </div>
            </div>
          )}

          {/* Success State */}
          {status === "ok" && (
            <div className={styles.verifyContent}>
              <div className={`${styles.verifyIconContainer} ${styles.success}`}>

                <svg
                  width="56"
                  height="56"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
              <h2 className={`${styles.verifyHeading} ${styles.success}`}>Email verified!</h2>
              <p className={styles.verifyText}>
                Your email has been successfully verified. You can now log in to your account.
              </p>
              <p className={styles.verifyRedirectText}>Redirecting to login in 2 seconds...</p>
              <div className={styles.verifyActions}>
                <button onClick={() => nav("/login")} className={`${styles.verifyBtn} ${styles.verifyBtnPrimary}`}>
                  Go to login now
                </button>
              </div>
            </div>
          )}

          {/* Error State */}
          {status === "error" && (
            <div className={styles.verifyContent}>
              <div className={`${styles.verifyIconContainer} ${styles.error}`}>
                <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="15" y1="9" x2="9" y2="15" />
                  <line x1="9" y1="9" x2="15" y2="15" />
                </svg>
              </div>
              <h2 className={`${styles.verifyHeading} ${styles.error}`}>Verification failed</h2>
              {err && <p className={styles.verifyErrorMessage}>{err}</p>}
              <p className={styles.verifyText}>
                This link may have expired, already been used, or is invalid. Please request a new verification email.
              </p>

              <div className={styles.verifyActions}>
                <Link to="/login" className={`${styles.verifyBtn} ${styles.verifyBtnPrimary}`}>
                  Go to login
                </Link>
                {emailHint ? (
                  <button
                    onClick={onResend}
                    disabled={loadingResend}
                    className={`${styles.verifyBtn} ${styles.verifyBtnSecondary}`}
                  >
                    {loadingResend ? (
                      <>
                        <span className={styles.verifyBtnSpinner} />
                        Sending...
                      </>
                    ) : (
                      "Resend verification email"
                    )}
                  </button>
                ) : (
                  <Link to="/login" className={`${styles.verifyBtn} ${styles.verifyBtnSecondary}`}>
                    Resend from login page
                  </Link>
                )}
              </div>

              {!emailHint && (
                <div className={styles.verifyTip}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="16" x2="12" y2="12" stroke="white" strokeWidth="2" />
                    <line x1="12" y1="8" x2="12.01" y2="8" stroke="white" strokeWidth="2" />
                  </svg>
                  <span>To resend directly from this page, the link must include your email address.</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className={styles.verifyFooter}>
          <p>
            Need help? <Link to="/support">Contact support</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
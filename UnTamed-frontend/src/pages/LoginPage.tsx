import type { FormEvent } from "react";
import { useState } from "react";
import { BadgeDollarSign, CalendarOff, CheckCircle2, Clock3, Lock, Send, ShieldAlert } from "lucide-react";
import { useNavigate } from "react-router-dom";

import styles from "../style/login.module.css";
import { BackButton } from "../components/BackButton";
import { AuthToast } from "../components/auth/AuthToast";
import { useAuth } from "../auth/auth.store";
import { roleHome } from "../auth/roleRouting";
import { getErrorMessage } from "../utils/errorNessage";
import { submitSuspensionAppeal } from "../api/auth.api";
import type { SuspendedLoginResponse } from "../types/auth";

type SuspendedState = Pick<SuspendedLoginResponse, "appealToken" | "expiresInSeconds" | "message">;

function responseData(error: any): any {
  return error?.response?.data ?? error?.data;
}

function isSuspendedLogin(error: any): boolean {
  return responseData(error)?.error === "ACCOUNT_SUSPENDED";
}

function apiMessage(error: any, fallback: string) {
  const data = responseData(error);
  if (typeof data === "string" && data.trim()) return data;
  if (typeof data?.message === "string" && data.message.trim()) return data.message;
  if (typeof data?.error === "string" && data.error.trim()) return data.error;
  return fallback;
}

function loginErrorMessage(error: any) {
  const status = error?.response?.status ?? error?.status;
  const message = apiMessage(error, "").toLowerCase();

  if (
    status === 400 ||
    status === 401 ||
    message.includes("bad credentials") ||
    message.includes("invalid credentials") ||
    message.includes("invalid email") ||
    message.includes("invalid password")
  ) {
    return "Invalid email or password. Please check your details and try again.";
  }

  if (status === 403) {
    return "This account cannot sign in right now. Please contact support if this seems wrong.";
  }

  if (!error?.response) {
    return "We could not reach the server. Please check your connection and try again.";
  }

  if (status >= 500) {
    return "We could not sign you in right now. Please try again in a moment.";
  }

  return getErrorMessage(error);
}

export function LoginPage() {
  const nav = useNavigate();
  const { signIn } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [suspended, setSuspended] = useState<SuspendedState | null>(null);
  const [appealDescription, setAppealDescription] = useState("");
  const [appealError, setAppealError] = useState<string | null>(null);
  const [appealSuccess, setAppealSuccess] = useState<{ message: string; reportId: string } | null>(null);
  const [appealSubmitting, setAppealSubmitting] = useState(false);

  function backToLogin() {
    setSuspended(null);
    setAppealDescription("");
    setAppealError(null);
    setAppealSuccess(null);
    setLoading(false);
    setErr(null);
    setPassword("");
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setErr(null);
    setSuspended(null);
    setAppealError(null);
    setAppealSuccess(null);
    setLoading(true);

    try {
      const user = await signIn(email.trim(), password);
      nav(roleHome(user.role), { replace: true });
    } catch (e: any) {
      if (isSuspendedLogin(e)) {
        const data = responseData(e) as SuspendedLoginResponse;
        setSuspended({
          appealToken: data.appealToken,
          expiresInSeconds: data.expiresInSeconds,
          message: data.message,
        });
      } else {
        setErr(loginErrorMessage(e));
      }
    } finally {
      setLoading(false);
    }
  }

  async function onAppealSubmit(e: FormEvent) {
    e.preventDefault();
    if (!suspended || appealSuccess) return;

    const description = appealDescription.trim();
    setAppealError(null);

    if (description.length < 10) {
      setAppealError("Please write at least 10 characters so our team has enough context.");
      return;
    }

    setAppealSubmitting(true);
    try {
      const result = await submitSuspensionAppeal({
        appealToken: suspended.appealToken,
        description,
      });
      setAppealSuccess(result);
    } catch (e: any) {
      const status = e?.response?.status ?? e?.status;
      if (status === 401) {
        setAppealError("This review link has expired. Please try logging in again to request a new review.");
      } else {
        setAppealError(apiMessage(e, "Could not submit your appeal. Please try again."));
      }
    } finally {
      setAppealSubmitting(false);
    }
  }

  return (
    <>
      <div className={styles.fixedTopLeft}>
        <BackButton />
      </div>

      <AuthToast message={err} title="Sign in failed" onClose={() => setErr(null)} />

      <div className={styles.loginWrap}>
        <div className={`${styles.loginCard} ${suspended ? styles.suspendedCard : ""}`}>
          {suspended ? (
            <div className={styles.suspendedPanel}>
              <header className={styles.suspendedHeader}>
                <div className={styles.suspendedBrand}>
                  <span className={styles.suspendedLogo} aria-hidden="true">
                    <ShieldAlert size={18} />
                  </span>
                  <span>UnTamed</span>
                </div>
                <div className={styles.restrictedBadge}>
                  <span aria-hidden="true" />
                  Access restricted
                </div>
              </header>

              <div className={styles.suspendedBody}>
                <section className={styles.suspendedIntro}>
                  <span className={styles.suspendedStatusIcon} aria-hidden="true">
                    <Lock size={23} />
                  </span>
                  <div>
                    <h2>Account suspended</h2>
                    <p>{suspended.message || "Your account is under admin review. Here's what this means for your bookings."}</p>
                  </div>
                </section>

                <div className={styles.suspensionEffects} aria-label="Account suspension effects">
                  <article>
                    <CalendarOff size={17} aria-hidden="true" />
                    <div>
                      <strong>New bookings are not available</strong>
                      <span>Future sessions cannot be booked until the review is complete.</span>
                    </div>
                  </article>
                  <article>
                    <Clock3 size={17} aria-hidden="true" />
                    <div>
                      <strong>Upcoming bookings are under review</strong>
                      <span>Pending bookings may be checked by admin as part of the review.</span>
                    </div>
                  </article>
                  <article>
                    <BadgeDollarSign size={17} aria-hidden="true" />
                    <div>
                      <strong>Paid bookings are handled by admins</strong>
                      <span>If action is needed, the admin team reviews payment and refund status.</span>
                    </div>
                  </article>
                </div>

                <section className={styles.appealCard}>
                  {appealSuccess ? (
                    <div className={styles.appealSuccess} role="status">
                      <CheckCircle2 size={24} />
                      <div>
                        <strong>Your appeal has been submitted.</strong>
                        <span>Our team will review it soon.</span>
                        {appealSuccess.reportId && <small>Reference: {appealSuccess.reportId}</small>}
                      </div>
                    </div>
                  ) : (
                    <form className={styles.appealForm} onSubmit={onAppealSubmit}>
                      <div className={styles.sectionHeading}>
                        <div>
                          <span className={styles.suspendedKicker}>Submit appeal</span>
                          <h3>Tell us why this should be reviewed</h3>
                        </div>
                      </div>

                      <div className={styles.formGroup}>
                        <label htmlFor="appealDescription">Appeal message</label>
                        <textarea
                          id="appealDescription"
                          value={appealDescription}
                          onChange={(ev) => {
                            setAppealDescription(ev.target.value.slice(0, 2000));
                            setAppealError(null);
                          }}
                          placeholder="Share any context that may help the team review this decision."
                          minLength={10}
                          maxLength={2000}
                          required
                        />
                        <div className={styles.textareaMeta}>
                          <span>Minimum 10 characters</span>
                          <span>{appealDescription.length}/2000</span>
                        </div>
                      </div>

                      {appealError && <div className={styles.errorMessage}>{appealError}</div>}

                      <div className={styles.appealActions}>
                        <button type="submit" className={styles.loginBtn} disabled={appealSubmitting}>
                          <Send size={16} />
                          {appealSubmitting ? "Submitting..." : "Submit appeal"}
                        </button>
                        <button type="button" className={styles.secondaryAction} onClick={backToLogin}>
                          Back to login
                        </button>
                      </div>
                    </form>
                  )}

                  {appealSuccess && (
                    <button type="button" className={styles.secondaryAction} onClick={backToLogin}>
                      Back to login
                    </button>
                  )}
                </section>
              </div>

              <footer className={styles.suspendedFooter}>
                <span>
                  <Clock3 size={15} aria-hidden="true" />
                  Review link expires in
                </span>
                <strong>{Math.ceil(suspended.expiresInSeconds / 60)} minutes</strong>
              </footer>
            </div>
          ) : (
            <>
              <div className={styles.loginHeader}>
                <div className={styles.loginBrand}>
                  <span className={styles.loginDot} />
                  <span>UnTamed</span>
                </div>
                <h2>Welcome Back</h2>
                <p>Sign in to continue your adventure</p>
              </div>

              <form className={styles.loginForm} onSubmit={onSubmit}>
                <div className={styles.formGroup}>
                  <label htmlFor="email">Email</label>
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(ev) => {
                      setEmail(ev.target.value);
                      setErr(null);
                    }}
                    placeholder="you@email.com"
                    required
                    autoComplete="email"
                  />
                </div>

                <div className={styles.formGroup}>
                  <label htmlFor="password">Password</label>
                  <div className={styles.passwordWrapper}>
                    <input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(ev) => {
                        setPassword(ev.target.value);
                        setErr(null);
                      }}
                      placeholder="••••••••"
                      required
                      autoComplete="current-password"
                    />
                    <button
                      type="button"
                      className={styles.passwordToggle}
                      onClick={() => setShowPassword((s) => !s)}
                    >
                      {showPassword ? "Hide" : "Show"}
                    </button>
                  </div>
                </div>

                <button type="submit" className={styles.loginBtn} disabled={loading}>
                  {loading ? "Signing in..." : "Sign in"}
                </button>

                <div className={styles.forgotPassword}>
                  <a href="/forgot-password">Forgot password?</a>
                </div>
              </form>

              <div className={styles.signupLink}>
                Don&apos;t have an account? <a href="/register">Sign up</a>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}

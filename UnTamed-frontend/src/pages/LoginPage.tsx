import type { FormEvent } from "react";
import { useState } from "react";
import { ArrowLeft, CheckCircle2, Send, ShieldAlert } from "lucide-react";
import { useNavigate } from "react-router-dom";

import styles from "../style/login.module.css";
import { BackButton } from "../components/BackButton";
import { useAuth } from "../auth/auth.store";
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

export function LoginPage() {
  const nav = useNavigate();
  const { signIn } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [suspended, setSuspended] = useState<SuspendedState | null>(null);
  const [appealOpen, setAppealOpen] = useState(false);
  const [appealDescription, setAppealDescription] = useState("");
  const [appealError, setAppealError] = useState<string | null>(null);
  const [appealSuccess, setAppealSuccess] = useState<{ message: string; reportId: string } | null>(null);
  const [appealSubmitting, setAppealSubmitting] = useState(false);

  function backToLogin() {
    setSuspended(null);
    setAppealOpen(false);
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
    setAppealOpen(false);
    setAppealError(null);
    setAppealSuccess(null);
    setLoading(true);

    try {
      await signIn(email.trim(), password);
      nav("/home", { replace: true });
    } catch (e: any) {
      if (isSuspendedLogin(e)) {
        const data = responseData(e) as SuspendedLoginResponse;
        setSuspended({
          appealToken: data.appealToken,
          expiresInSeconds: data.expiresInSeconds,
          message: data.message,
        });
      } else {
        setErr(getErrorMessage(e));
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
      setAppealOpen(false);
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

      <div className={styles.loginWrap}>
        <div className={styles.loginCard}>
          {suspended ? (
            <div className={styles.suspendedPanel}>
              <div className={styles.suspendedIconWrap} aria-hidden="true">
                <ShieldAlert size={30} />
              </div>

              <div className={styles.loginBrand}>
                <span className={styles.loginDot} />
                <span>UnTamed</span>
              </div>

              <div className={styles.suspendedHeader}>
                <span className={styles.suspendedKicker}>Access review</span>
                <h2>Account suspended</h2>
                <p>
                  {suspended.message || "Your account has been suspended."} You cannot currently access UnTamed.
                </p>
              </div>

              {appealSuccess ? (
                <div className={styles.appealSuccess} role="status">
                  <CheckCircle2 size={22} />
                  <div>
                    <strong>Your appeal has been submitted.</strong>
                    <span>Our team will review it soon.</span>
                    {appealSuccess.reportId && <small>Reference: {appealSuccess.reportId}</small>}
                  </div>
                </div>
              ) : (
                <>
                  <div className={styles.suspendedInfo}>
                    <span>Review link expires in</span>
                    <strong>{Math.ceil(suspended.expiresInSeconds / 60)} minutes</strong>
                    <p>If you believe this is a mistake, you can request a review.</p>
                  </div>

                  {!appealOpen ? (
                    <button type="button" className={styles.loginBtn} onClick={() => setAppealOpen(true)}>
                      Request a review
                    </button>
                  ) : (
                    <form className={styles.appealForm} onSubmit={onAppealSubmit}>
                      <div className={styles.formGroup}>
                        <label htmlFor="appealDescription">Tell us why we should review your suspension</label>
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

                      <button type="submit" className={styles.loginBtn} disabled={appealSubmitting}>
                        <Send size={16} />
                        {appealSubmitting ? "Submitting..." : "Submit appeal"}
                      </button>
                    </form>
                  )}
                </>
              )}

              {!appealOpen && appealError && <div className={styles.errorMessage}>{appealError}</div>}

              <button type="button" className={styles.secondaryAction} onClick={backToLogin}>
                <ArrowLeft size={16} />
                Back to login
              </button>
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
                    onChange={(ev) => setEmail(ev.target.value)}
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
                      onChange={(ev) => setPassword(ev.target.value)}
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

                {err && <div className={styles.errorMessage}>{err}</div>}

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

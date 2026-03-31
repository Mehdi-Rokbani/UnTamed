import { useState } from "react";
import { useNavigate } from "react-router-dom";

import styles from "../style/login.module.css";
import { BackButton } from "../components/BackButton";
import { useAuth } from "../auth/auth.store";
import { getErrorMessage } from "../utils/errorNessage";

export function LoginPage() {
  const nav = useNavigate();
  const { signIn } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setLoading(true);

    try {
      await signIn(email.trim(), password);
      nav("/home", { replace: true });
    } catch (e: any) {
      setErr(getErrorMessage(e));
    } finally {
      setLoading(false);
    }

  }

  return (
    <>
      <div className={styles.fixedTopLeft}>
        <BackButton />
      </div>

      <div className={styles.loginWrap}>
        <div className={styles.loginCard}>
          <div className={styles.loginHeader}>
            <div className={styles.loginBrand}>
              <span className={styles.loginDot} />
              <span>UnTamed</span>
            </div>
            <h2>Welcome Back</h2>
            <p>Sign in to continue your adventure</p>
          </div>

          <form className={styles.loginForm} onSubmit={onSubmit}>
            <div className={styles.formGroup} >
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
        </div>
      </div>
    </>
  );
}

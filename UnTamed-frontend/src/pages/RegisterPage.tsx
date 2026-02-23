import { useMemo, useState, type ReactElement } from "react";
import { useNavigate, Link } from "react-router-dom";
import styles from "../style/register.module.css";
import { BackButton } from "../components/BackButton";
import { passwordRules } from "../utils/paswordRules";

import {
  register as registerApi,
  resendVerification,
  usernameAvailable,
  emailAvailable,
} from "../api/auth.api";
import type { Role, Level } from "../types/auth";

// Added EXPERT
const LEVELS: Level[] = ["BEGINNER", "INTERMEDIATE", "ADVANCED", "EXPERT"];
type Step = 1 | 2 | 3;

function isValidEmail(v: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

export function RegisterPage() {
  const nav = useNavigate();

  const [step, setStep] = useState<Step>(1);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  const [registeredEmail, setRegisteredEmail] = useState<string | null>(null);

  // Step 1
  const [role, setRole] = useState<Role>("USER");
  const [username, setUsername] = useState("");

  // Step 2
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // Step 3 (USER only)
  const [level, setLevel] = useState<Level>("BEGINNER");

  const pw = passwordRules(password, username, email);

  const title = useMemo(() => {
    if (step === 1) return "Profile & Role";
    if (step === 2) return "Account Credentials";
    return role === "USER" ? "Experience Level" : "Almost There";
  }, [step, role]);

  async function nextFromStep1() {
    setErr(null);
    const u = username.trim();
    if (u.length < 3) return setErr("Username must be at least 3 characters.");
    setChecking(true);
    try {
      const ok = await usernameAvailable(u);
      if (!ok) return setErr("Username already taken. Please choose another one.");
      setStep(2);
    } catch (e: any) {
      setErr(e?.message ?? "Could not check username.");
    } finally {
      setChecking(false);
    }
  }

  async function nextFromStep2() {
    setErr(null);
    const e = email.trim().toLowerCase();
    if (!isValidEmail(e)) return setErr("Please enter a valid email address.");
    if (!pw.requiredOk) return setErr("Password doesn't meet all requirements. Check the rules below.");
    setChecking(true);
    try {
      const ok = await emailAvailable(e);
      if (!ok) return setErr("Email already registered. Try logging in or use a different email.");
      setEmail(e);
      setStep(3);
    } catch (e: any) {
      setErr(e?.message ?? "Could not check email.");
    } finally {
      setChecking(false);
    }
  }

  async function submit() {
    setErr(null);
    setLoading(true);
    try {
      const e = email.trim().toLowerCase();
      const base = { email: e, password, username: username.trim(), role };
      const payload = role === "USER" ? { ...base, level } : base;
      const user = await registerApi(payload as any);
      setRegisteredEmail(user.email);
      setErr(null);
    } catch (e: any) {
      setErr(e?.message ?? "Registration failed");
    } finally {
      setLoading(false);
    }
  }

  async function onResend() {
    if (!registeredEmail) return;
    setErr(null);
    setLoading(true);
    try {
      await resendVerification(registeredEmail);
    } catch (e: any) {
      setErr(e?.message ?? "Could not resend verification email");
    } finally {
      setLoading(false);
    }
  }

  const levelDescriptions: Record<Level, string> = {
    BEGINNER: "New to outdoor adventures",
    INTERMEDIATE: "Some experience with activities",
    ADVANCED: "Experienced adventurer",
    EXPERT: "Outdoor expert & leader",
  };

  const levelIcons: Record<Level, ReactElement> = {
    BEGINNER: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
      </svg>
    ),
    INTERMEDIATE: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
      </svg>
    ),
    ADVANCED: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M3 17l4-8 4 4 4-6 4 10" />
        <path d="M3 21h18" />
      </svg>
    ),
    EXPERT: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="8" r="6" />
        <path d="M15.477 12.89L17 22l-5-3-5 3 1.523-9.11" />
      </svg>
    ),
  };

  /**
   * ✅ FIX TS7053 (no any): make rule keys a typed union of pw.checks keys
   *
   * Your passwordRules() returns pw.checks with keys like:
   * len, upper, lower, digit, symbol, noSpace
   */
  type PwChecks = typeof pw.checks;
  type PwCheckKey = keyof PwChecks;

  const PASSWORD_RULES: Array<{ key: PwCheckKey; label: string }> = [
    { key: "len", label: "8+ characters" },
    { key: "upper", label: "Uppercase (A-Z)" },
    { key: "lower", label: "Lowercase (a-z)" },
    { key: "digit", label: "Number (0-9)" },
    { key: "symbol", label: "Special (!@#$...)" },
    { key: "noSpace", label: "No spaces" },
  ];

  return (
    <>
      <div className={styles.fixedTopLeft}>
        <BackButton />
      </div>

      <div className={styles.regWrap}>
        <div className={styles.regCard}>
          {/* LEFT PANEL */}
          <div className={styles.regLeft}>
            <div className={styles.regBrand}>
              <div className={styles.regLogo}></div>
              <span className={styles.regBrandText}>UnTamed</span>
            </div>

            <h2 className={styles.regWelcome}>Join the Adventure</h2>
            <p className={styles.regTagline}>Create your account in 3 simple steps and start exploring.</p>

            <div className={styles.stepper}>
              <div className={`step-item ${step >= 1 ? "active" : ""} ${step > 1 ? "completed" : ""}`}>
                <div className={styles.stepBullet}>
                  {step > 1 ? (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  ) : (
                    "1"
                  )}
                </div>
                <div className={styles.stepContent}>
                  <div className={styles.stepTitle}>Profile</div>
                  <div className={styles.stepDesc}>Choose role & username</div>
                </div>
              </div>

              <div className={`step-item ${step >= 2 ? "active" : ""} ${step > 2 ? "completed" : ""}`}>
                <div className={styles.stepBullet}>
                  {step > 2 ? (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  ) : (
                    "2"
                  )}
                </div>
                <div className={styles.stepContent}>
                  <div className={styles.stepTitle}>Credentials</div>
                  <div className={styles.stepDesc}>Secure your account</div>
                </div>
              </div>

              <div className={`step-item ${step >= 3 ? "active" : ""}`}>
                <div className={styles.stepBullet}>3</div>
                <div className={styles.stepContent}>
                  <div className={styles.stepTitle}>Finish</div>
                  <div className={styles.stepDesc}>{role === "USER" ? "Set experience level" : "Complete setup"}</div>
                </div>
              </div>
            </div>

            <div className={styles.regFeatures}>
              <div className={styles.featureItem}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M22 11.08V12a10 10 0 11-5.93-9.14" />
                  <polyline points="22 4 12 14.01 9 11.01" />
                </svg>
                <span>Verified adventures</span>
              </div>
              <div className={styles.featureItem}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
                </svg>
                <span>Expert guides</span>
              </div>
              <div className={styles.featureItem}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                </svg>
                <span>Top-rated experiences</span>
              </div>
            </div>
          </div>

          {/* RIGHT PANEL */}
          <div className={styles.regRight}>
            {/* SUCCESS VIEW */}
            {registeredEmail && (
              <div className={styles.successView}>
                <div className={styles.successIcon}>
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M22 11.08V12a10 10 0 11-5.93-9.14" />
                    <polyline points="22 4 12 14.01 9 11.01" />
                  </svg>
                </div>
                <h2 className={styles.successTitle}>Check your email</h2>
                <p className={styles.successText}>
                  We've created your account! Please verify your email to activate it and start your adventure.
                </p>
                <div className={styles.emailDisplay}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                    <polyline points="22,6 12,13 2,6" />
                  </svg>
                  <span>{registeredEmail}</span>
                </div>

                <div className={styles.successTip}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="16" x2="12" y2="12" stroke="white" strokeWidth="2" />
                    <line x1="12" y1="8" x2="12.01" y2="8" stroke="white" strokeWidth="2" />
                  </svg>
                  <span>Can't find it? Check your spam or promotions folder.</span>
                </div>

                {err && <div className={styles.errorBanner}>{err}</div>}

                <div className={styles.successActions}>
                  <button className={styles.regBtnSecondary} onClick={() => nav("/login")}>
                    Go to login
                  </button>
                  <button className={styles.regBtnPrimary} onClick={onResend} disabled={loading}>
                    {loading ? (
                      <>
                        <span className={styles.btnSpinner} />
                        Sending...
                      </>
                    ) : (
                      "Resend verification"
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* REGISTRATION STEPS */}
            {!registeredEmail && (
              <>
                <div className={styles.regHeader}>
                  <div className={styles.stepBadge}>Step {step} of 3</div>
                  <h2 className={styles.regTitle}>{title}</h2>
                  <p className={styles.regSubtitle}>
                    {step === 1 && "Tell us a bit about yourself"}
                    {step === 2 && "Create secure login credentials"}
                    {step === 3 && role === "USER" && "What's your adventure experience?"}
                    {step === 3 && role !== "USER" && "You're all set!"}
                  </p>
                </div>

                {/* STEP 1 */}
                {step === 1 && (
                  <>
                    <div className={styles.fieldGroup}>
                      <label className={styles.fieldLabel}>I want to join as</label>
                      <div className={styles.roleSelector}>
                        <button
                          type="button"
                          className={`role-card ${role === "USER" ? "selected" : ""}`}
                          onClick={() => setRole("USER")}
                        >
                          <div className={styles.roleIcon}>
                            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
                              <circle cx="12" cy="7" r="4" />
                            </svg>
                          </div>
                          <div className={styles.roleName}>Adventurer</div>
                          <div className={styles.roleDesc}>Discover and join activities</div>
                        </button>

                        <button
                          type="button"
                          className={`role-card ${role === "GUIDE" ? "selected" : ""}`}
                          onClick={() => setRole("GUIDE")}
                        >
                          <div className={styles.roleIcon}>
                            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
                              <circle cx="9" cy="7" r="4" />
                              <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
                            </svg>
                          </div>
                          <div className={styles.roleName}>Guide</div>
                          <div className={styles.roleDesc}>Host and lead adventures</div>
                        </button>
                      </div>
                    </div>

                    <div className={styles.fieldGroup}>
                      <label className={styles.fieldLabel} htmlFor="username">
                        Username
                      </label>
                      <div className={styles.inputWrapper}>
                        <span className={styles.inputPrefix}>@</span>
                        <input
                          id="username"
                          type="text"
                          className={`${styles.fieldInput} ${styles.hasPrefix}`}
                          value={username}
                          onChange={(e) => setUsername(e.target.value)}
                          placeholder="mehdi_adventures"
                        />
                      </div>
                      <div className={styles.fieldHint}>This will be your unique identifier</div>
                    </div>

                    {err && <div className={styles.errorBanner}>{err}</div>}

                    <div className={styles.formActions}>
                      <Link className={styles.linkText} to="/login">
                        Already have an account?
                      </Link>
                      <button className={`${styles.regBtn} ${styles.regBtnPrimary}`} onClick={nextFromStep1} disabled={checking}>
                        {checking ? (
                          <>
                            <span className={styles.btnSpinner} />
                            Checking...
                          </>
                        ) : (
                          <>
                            Continue{" "}
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <line x1="5" y1="12" x2="19" y2="12" />
                              <polyline points="12 5 19 12 12 19" />
                            </svg>
                          </>
                        )}
                      </button>
                    </div>
                  </>
                )}

                {/* STEP 2 */}
                {step === 2 && (
                  <>
                    <div className={styles.fieldGroup}>
                      <label className={styles.fieldLabel} htmlFor="email">
                        Email address
                      </label>
                      <div className={styles.inputWrapper}>
                        <input
                          id="email"
                          type="email"
                          className={styles.fieldInput}
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="you@example.com"
                        />
                        <span className={styles.inputIcon}>
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                            <polyline points="22,6 12,13 2,6" />
                          </svg>
                        </span>
                      </div>
                    </div>

                    <div className={styles.fieldGroup}>
                      <label className={styles.fieldLabel} htmlFor="password">
                        Password
                      </label>
                      <div className={styles.inputWrapper}>
                        <input
                          id="password"
                          type={showPassword ? "text" : "password"}
                          className={styles.fieldInput}
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="••••••••••"
                        />
                        <button
                          type="button"
                          className={styles.inputAction}
                          onClick={() => setShowPassword(!showPassword)}
                          tabIndex={-1}
                        >
                          {showPassword ? (
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24" />
                              <line x1="1" y1="1" x2="23" y2="23" />
                            </svg>
                          ) : (
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                              <circle cx="12" cy="12" r="3" />
                            </svg>
                          )}
                        </button>
                      </div>

                      <div className={styles.passwordStrength}>
                        <div className={styles.strengthBars}>
                          <div className={`${styles.strengthBar} ${pw.score >= 2 ? styles.active : ""}`} />
                          <div className={`${styles.strengthBar} ${pw.score >= 4 ? styles.active : ""}`} />
                          <div className={`${styles.strengthBar} ${pw.score >= 6 ? styles.active : ""}`} />
                          <div className={`${styles.strengthBar} ${pw.score >= 8 ? styles.active : ""}`} />
                        </div>
                        <span className={styles.strengthText}>
                          {pw.score === 0 && "Enter password"}
                          {pw.score > 0 && pw.score < 4 && "Weak"}
                          {pw.score >= 4 && pw.score < 7 && "Fair"}
                          {pw.score >= 7 && pw.score < 9 && "Good"}
                          {pw.score >= 9 && "Strong"}
                        </span>
                      </div>
                    </div>

                    <div className={styles.passwordRules}>
                      <div className={styles.rulesHeader}>Password must contain:</div>
                      <div className={styles.rulesGrid}>
                        {PASSWORD_RULES.map(({ key, label }) => (
                          <div key={key} className={`${styles.ruleItem} ${pw.checks[key] ? styles.valid : ""}`}>
                            <div className={styles.ruleIcon}>
                              {pw.checks[key] ? (
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                                  <polyline points="20 6 9 17 4 12" />
                                </svg>
                              ) : (
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <circle cx="12" cy="12" r="10" />
                                </svg>
                              )}
                            </div>
                            <span>{label}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {err && <div className={styles.errorBanner}>{err}</div>}

                    <div className={styles.formActions}>
                      <button className={`${styles.regBtn} ${styles.regBtnSecondary}`} onClick={() => setStep(1)}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <line x1="19" y1="12" x2="5" y2="12" />
                          <polyline points="12 19 5 12 12 5" />
                        </svg>
                        Back
                      </button>
                      <button
                        className={`${styles.regBtn} ${styles.regBtnPrimary}`}
                        onClick={nextFromStep2}
                        disabled={checking || !pw.requiredOk}
                      >
                        {checking ? (
                          <>
                            <span className={styles.btnSpinner} />
                            Checking...
                          </>
                        ) : (
                          <>
                            Continue{" "}
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <line x1="5" y1="12" x2="19" y2="12" />
                              <polyline points="12 5 19 12 12 19" />
                            </svg>
                          </>
                        )}
                      </button>
                    </div>
                  </>
                )}

                {/* STEP 3 */}
                {step === 3 && (
                  <>
                    {role === "USER" ? (
                      <div className={styles.fieldGroup}>
                        <label className={styles.fieldLabel}>Select your experience level</label>
                        <div className={styles.levelSelector}>
                          {LEVELS.map((l) => (
                            <button
                              key={l}
                              type="button"
                              className={`${styles.levelCard} ${level === l ? styles.selected : ""}`}
                              onClick={() => setLevel(l)}
                            >
                              <div className={styles.levelIcon}>{levelIcons[l]}</div>
                              <div className={styles.levelName}>{l.charAt(0) + l.slice(1).toLowerCase()}</div>
                              <div className={styles.levelDesc}>{levelDescriptions[l]}</div>
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className={styles.guideFinish}>
                        <div className={styles.finishIcon}>
                          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M22 11.08V12a10 10 0 11-5.93-9.14" />
                            <polyline points="22 4 12 14.01 9 11.01" />
                          </svg>
                        </div>
                        <h3 className={styles.finishTitle}>You're all set!</h3>
                        <p className={styles.finishText}>
                          As a guide, you can add certificates and credentials later from your profile page.
                        </p>
                      </div>
                    )}

                    {err && <div className={styles.errorBanner}>{err}</div>}

                    <div className={styles.formActions}>
                      <button className={`${styles.regBtn} ${styles.regBtnSecondary}`} onClick={() => setStep(2)}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <line x1="19" y1="12" x2="5" y2="12" />
                          <polyline points="12 19 5 12 12 5" />
                        </svg>
                        Back
                      </button>
                      <button className={`${styles.regBtn} ${styles.regBtnPrimary}`} onClick={submit} disabled={loading}>
                        {loading ? (
                          <>
                            <span className={styles.btnSpinner} />
                            Creating account...
                          </>
                        ) : (
                          <>
                            Create account{" "}
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                          </>
                        )}
                      </button>
                    </div>
                  </>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
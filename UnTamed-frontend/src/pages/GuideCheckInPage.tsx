import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useAuth } from "../auth/auth.store";
import * as GuestPassApi from "../api/guestPass.api";
import type { VerifyGuestPassResponse } from "../api/guestPass.api";
import styles from "../style/guide-check-in.module.css";

function shortId(id?: string | null): string {
  if (!id) return "N/A";
  return id.length <= 10 ? id : `${id.slice(0, 6)}...${id.slice(-4)}`;
}

function formatDateTime(iso?: string | null): string {
  if (!iso) return "Unavailable";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getStatus(result: VerifyGuestPassResponse | null, state: "loading" | "ready" | "error") {
  if (state === "loading") {
    return { label: "Verifying pass", className: styles.statusNeutral };
  }

  if (state === "error" || !result?.valid) {
    return { label: "Invalid pass", className: styles.statusDanger };
  }

  if (result.passStatus === "CANCELLED") {
    return { label: "Pass cancelled", className: styles.statusDanger };
  }

  if (result.attendanceStatus === "PRESENT") {
    return { label: "Present", className: styles.statusPresent };
  }

  if (result.attendanceStatus === "ABSENT") {
    return { label: "Marked absent", className: styles.statusDanger };
  }

  return { label: "Not checked in yet", className: styles.statusPending };
}

function getHttpStatus(message: string): number | null {
  const match = message.match(/HTTP\s+(\d+)/i);
  return match ? Number(match[1]) : null;
}

function friendlyActionError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error || "");
  const status = getHttpStatus(message);
  const lower = message.toLowerCase();

  if (status === 401) return "You must be logged in as the guide to mark attendance.";
  if (status === 403) return "Only the guide assigned to this activity can mark attendance.";
  if (status === 404) return "Invalid guest pass.";
  if (status === 409 && /start|starts|started|activity/i.test(message)) {
    return "Check-in opens when the activity starts.";
  }
  if (status === 409) {
    if (lower.includes("paid")) return "This booking is not paid yet.";
    if (lower.includes("cancel")) return "This booking or pass has been cancelled.";
    return message.replace(/^HTTP\s+409:\s*/i, "") || "This pass is not eligible for attendance marking yet.";
  }

  return message || "Could not update attendance.";
}

function friendlyVerifyError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error || "");
  const status = getHttpStatus(message);

  if (status === 401) return "Guide login required to scan this pass.";
  if (status === 403) return "Only the guide who created this activity can scan this pass.";
  if (status === 404) return "Invalid guest pass.";
  if (status === 409) return message.replace(/^HTTP\s+409:\s*/i, "") || "Check-in is only allowed after the activity starts.";

  return "Could not verify this pass.";
}

function CheckIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function TopBar() {
  return (
    <header className={styles.topBar}>
      <Link to="/" className={styles.brand}>
        <span>Un</span>Tamed
      </Link>
      <span className={styles.kicker}>Guide check-in verification</span>
    </header>
  );
}

export default function GuideCheckInPage() {
  const { token } = useParams();
  const { user, loading: authLoading } = useAuth();
  const [result, setResult] = useState<VerifyGuestPassResponse | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");
  const [busyAction, setBusyAction] = useState<"present" | "absent" | null>(null);

  const verify = useCallback(async () => {
    if (!token) {
      setError("Missing guest pass token.");
      setState("error");
      return;
    }

    setState("loading");
    setError("");
    try {
      const data = await GuestPassApi.verifyGuideGuestPass(token);
      setResult(data);
      setState(data.valid ? "ready" : "error");
      if (!data.valid) setError(data.message || "This guest pass is not valid.");
    } catch (e: unknown) {
      setError(friendlyVerifyError(e));
      setState("error");
    }
  }, [token]);

  useEffect(() => { void verify(); }, [verify]);

  async function markAttendance(next: "present" | "absent") {
    if (!token) return;
    setBusyAction(next);
    setActionError("");

    try {
      const data = next === "present"
        ? await GuestPassApi.markGuestPassPresent(token)
        : await GuestPassApi.markGuestPassAbsent(token);
      setResult(data);
      setState("ready");
    } catch (e: unknown) {
      setActionError(friendlyActionError(e));
    } finally {
      setBusyAction(null);
    }
  }

  const status = getStatus(result, state);
  const active = result?.valid === true && result.passStatus === "ACTIVE";
  const sessionStart = result?.sessionStartAt ? new Date(result.sessionStartAt) : null;
  const sessionStartsInFuture = !!sessionStart && !Number.isNaN(sessionStart.getTime()) && sessionStart.getTime() > Date.now();
  const guideUser = user?.role === "GUIDE" || user?.role === "ADMIN";
  const notMarked = result?.attendanceStatus === "NOT_MARKED";
  const present = result?.attendanceStatus === "PRESENT";
  const absent = result?.attendanceStatus === "ABSENT";
  const cancelled = result?.passStatus === "CANCELLED";
  const canUseActions = active && guideUser && !authLoading && !sessionStartsInFuture;
  const canMarkPresent = canUseActions && (notMarked || absent);
  const canMarkAbsent = canUseActions && notMarked;

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <TopBar />

        {state === "loading" && (
          <section className={styles.stateCard} aria-live="polite">
            <span className={`${styles.statusBanner} ${status.className}`}>{status.label}</span>
            <div className={styles.spinner} />
            <h1>Verifying trail pass</h1>
            <p>Checking the guest pass before attendance is marked.</p>
          </section>
        )}

        {state === "error" && (
          <section className={styles.stateCard} aria-live="polite">
            <span className={`${styles.statusBanner} ${status.className}`}>{status.label}</span>
            <h1>Pass unavailable</h1>
            <p>{error || result?.message || "This pass could not be verified."}</p>
            <div className={styles.stateActions}>
              <button type="button" onClick={verify}>Try again</button>
              <Link to="/">Back to UnTamed</Link>
            </div>
          </section>
        )}

        {state === "ready" && result && (
          <section className={styles.card} aria-live="polite">
            <div className={styles.cardStatus}>
              <span className={`${styles.statusBanner} ${status.className}`}>{status.label}</span>
              {result.message && <p>{result.message}</p>}
            </div>

            <div className={styles.details}>
              <div className={styles.guestHero}>
                <span>{result.mainBooker ? "Main booker" : "Guest"}</span>
                <h1>{result.guestName ?? "Guest"}</h1>
                <p>{result.activityTitle ?? "Untamed adventure"}</p>
              </div>

              <div className={styles.factGrid}>
                <div>
                  <span>Session</span>
                  <strong>{formatDateTime(result.sessionStartAt)}</strong>
                </div>
                <div>
                  <span>Guest pass</span>
                  <strong>{result.passNumber} of {result.totalPasses}</strong>
                </div>
                <div>
                  <span>Booking ref</span>
                  <strong>#{shortId(result.bookingId)}</strong>
                </div>
                <div>
                  <span>Pass status</span>
                  <strong>{result.passStatus ?? "UNKNOWN"}</strong>
                </div>
                <div>
                  <span>Attendance</span>
                  <strong>{result.attendanceStatus ?? "UNKNOWN"}</strong>
                </div>
                <div>
                  <span>Marked at</span>
                  <strong>{result.markedAt ? formatDateTime(result.markedAt) : "Not marked"}</strong>
                </div>
              </div>
            </div>

            <aside className={styles.actionPanel}>
              {authLoading && (
                <div className={styles.actionNotice}>
                  <h2>Checking guide session</h2>
                  <p>Hold on while we verify whether this browser is logged in as a guide.</p>
                </div>
              )}

              {!present && !cancelled && !authLoading && !user && (
                <div className={styles.actionNotice}>
                  <h2>Guide login required</h2>
                  <p>Guide login required to mark attendance. You can still review the pass details here.</p>
                  <Link to="/login" className={styles.loginButton}>Log in as guide</Link>
                </div>
              )}

              {!present && !cancelled && !authLoading && user && !guideUser && (
                <div className={styles.actionNotice}>
                  <h2>Guide access required</h2>
                  <p>Only guides can mark attendance for guest passes.</p>
                </div>
              )}

              {!present && !cancelled && !authLoading && user && guideUser && sessionStartsInFuture && (
                <div className={styles.actionNotice}>
                  <h2>Check-in not open yet</h2>
                  <p>Check-in opens at {formatDateTime(result.sessionStartAt)}.</p>
                  <small>The backend remains the source of truth for attendance timing.</small>
                </div>
              )}

              {present && (
                <div className={styles.actionState}>
                  <div className={styles.successIcon}><CheckIcon /></div>
                  <h2>Guest is present</h2>
                  <p>{result.markedAt ? `Marked present at ${formatDateTime(result.markedAt)}.` : "Attendance has already been confirmed."}</p>
                  <button type="button" disabled>Mark present</button>
                </div>
              )}

              {absent && !authLoading && !!user && guideUser && !sessionStartsInFuture && (
                <div className={styles.actionState}>
                  <h2>Marked absent</h2>
                  <p>This can still be corrected if the guest arrives later.</p>
                  <button
                    type="button"
                    className={styles.primaryButton}
                    onClick={() => void markAttendance("present")}
                    disabled={!canMarkPresent || busyAction !== null}
                  >
                    {busyAction === "present" ? "Updating..." : "Mark present"}
                  </button>
                  <button type="button" className={styles.secondaryButton} disabled>Mark absent</button>
                </div>
              )}

              {notMarked && !cancelled && !authLoading && !!user && guideUser && !sessionStartsInFuture && (
                <div className={styles.actionState}>
                  <h2>Ready to verify</h2>
                  <p>Mark this guest when they arrive at the trail check-in point.</p>
                  <button
                    type="button"
                    className={styles.primaryButton}
                    onClick={() => void markAttendance("present")}
                    disabled={!canMarkPresent || busyAction !== null}
                  >
                    {busyAction === "present" ? "Marking..." : "Mark present"}
                  </button>
                  <button
                    type="button"
                    className={styles.secondaryButton}
                    onClick={() => void markAttendance("absent")}
                    disabled={!canMarkAbsent || busyAction !== null}
                  >
                    {busyAction === "absent" ? "Marking..." : "Mark absent"}
                  </button>
                  <small>Absent can be changed to present later.</small>
                </div>
              )}

              {cancelled && (
                <div className={styles.actionState}>
                  <h2>Pass cancelled</h2>
                  <p>This guest pass cannot be used for attendance.</p>
                  <button type="button" disabled>Actions disabled</button>
                </div>
              )}

              {actionError && <div className={styles.inlineError}>{actionError}</div>}
            </aside>
          </section>
        )}
      </div>
    </main>
  );
}

import { useEffect, useMemo, useState } from "react";
import styles from "../../style/checkout.module.css";

function formatRemaining(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export function BookingExpirationTimer({
  expiresAt,
  onExpired,
}: {
  expiresAt?: string | null;
  onExpired?: () => void;
}) {
  const expiresAtMs = useMemo(() => {
    if (!expiresAt) return null;
    const value = new Date(expiresAt).getTime();
    return Number.isFinite(value) ? value : null;
  }, [expiresAt]);

  const [now, setNow] = useState(Date.now());
  const remaining = expiresAtMs == null ? null : expiresAtMs - now;
  const expired = remaining != null && remaining <= 0;
  const warning = remaining != null && remaining > 0 && remaining < 3 * 60 * 1000;
  const progress = expiresAtMs == null
    ? 0
    : Math.max(0, Math.min(100, (Math.max(0, remaining ?? 0) / (15 * 60 * 1000)) * 100));

  useEffect(() => {
    if (expiresAtMs == null) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [expiresAtMs]);

  useEffect(() => {
    if (expired) onExpired?.();
  }, [expired, onExpired]);

  if (expiresAtMs == null) {
    return (
      <section className={styles.timerCard}>
        <span className={styles.timerMuted}>Expiration time unavailable</span>
      </section>
    );
  }

  return (
    <section className={`${styles.timerCard} ${expired ? styles.timerCardExpired : warning ? styles.timerCardWarning : ""}`}>
      <div className={styles.timerTopline}>
        <span>Reservation timer</span>
        {warning && !expired && <strong>Expiring soon</strong>}
        {expired && <strong>Expired</strong>}
      </div>
      <div className={styles.countdown}>{formatRemaining(remaining ?? 0)}</div>
      <div className={styles.progressTrack}>
        <span style={{ width: `${progress}%` }} />
      </div>
      <p>
        {expired
          ? "This booking has expired. Please start over."
          : "Your seats are held while you complete payment."}
      </p>
    </section>
  );
}

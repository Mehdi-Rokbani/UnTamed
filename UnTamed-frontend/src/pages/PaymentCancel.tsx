import type { CSSProperties } from "react";
import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { cancelStripePayment } from "../api/booking.api";
import { Header } from "../components/Header";
import styles from "../style/payment-status.module.css";

const reasons = [
  "I wanted to review the details",
  "Payment method did not work",
  "Price or fees surprised me",
  "I am still choosing dates",
];

function WarningMountainIcon() {
  return (
    <svg width="62" height="62" viewBox="0 0 64 64" fill="none" aria-hidden="true">
      <path
        d="M32 6L59 54H5L32 6Z"
        stroke="currentColor"
        strokeWidth="5"
        strokeLinejoin="round"
      />
      <path d="M18 48L30 28L38 40L43 33L52 48H18Z" fill="currentColor" opacity="0.78" />
      <path d="M32 21V34" stroke="currentColor" strokeWidth="5" strokeLinecap="round" />
      <path d="M32 43H32.01" stroke="currentColor" strokeWidth="6" strokeLinecap="round" />
    </svg>
  );
}

function InfoIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 10v6" strokeLinecap="round" />
      <path d="M12 7h.01" strokeLinecap="round" />
    </svg>
  );
}

export default function PaymentCancel() {
  const [searchParams] = useSearchParams();
  const bookingId = searchParams.get("bookingId");
  const [status, setStatus] = useState("Resetting your booking...");
  const [reason, setReason] = useState(reasons[0]);

  useEffect(() => {
    async function resetPayment() {
      if (!bookingId) {
        setStatus("Booking ID missing. Your trip may still be visible in My Bookings.");
        return;
      }

      try {
        await cancelStripePayment(bookingId);
        setStatus("Your cart is saved for 24 hours, and you can retry whenever you are ready.");
      } catch (err) {
        console.error("Failed to reset payment state:", err);
        setStatus("Payment was cancelled, but we could not reset the booking automatically.");
      }
    }

    resetPayment();
  }, [bookingId]);

  return (
    <>
      <Header />
      <main
        className={styles.page}
        style={{
          "--hero-bg": "#1C1410",
          "--body-bg": "#FAF6EE",
          "--accent": "#C1440E",
          "--badge-color": "#F0A06A",
        } as CSSProperties}
      >
        <section className={`${styles.hero} ${styles.crosshatch}`}>
          <div className={styles.heroInner}>
            <span className={styles.badge}>Payment cancelled</span>
            <div className={styles.iconRing}>
              <WarningMountainIcon />
            </div>
            <h1 className={styles.title}>Trail Paused</h1>
            <p className={styles.tagline}>No charges were made - your journey isn't over yet.</p>
          </div>
        </section>

      <section className={styles.body}>
        <div className={styles.content}>
          <article className={styles.reassuranceCard}>
            <div className={styles.infoIcon}>
              <InfoIcon />
            </div>
            <div>
              <h2 className={styles.reassuranceTitle}>Your place is not lost</h2>
              <p className={styles.reassuranceText}>{status}</p>
            </div>
          </article>

          <section className={styles.feedbackCard} aria-labelledby="feedback-title">
            <h2 className={styles.feedbackTitle} id="feedback-title">What stopped you?</h2>
            <div className={styles.reasons}>
              {reasons.map((item) => (
                <label className={styles.reason} key={item}>
                  <input
                    type="radio"
                    name="cancel-reason"
                    value={item}
                    checked={reason === item}
                    onChange={() => setReason(item)}
                  />
                  <span>{item}</span>
                </label>
              ))}
            </div>
          </section>

          <div className={styles.actions}>
            <Link to="/my-bookings" className={`${styles.button} ${styles.buttonOrange}`}>
              Retry Booking
            </Link>
            <Link to="/home" className={`${styles.button} ${styles.buttonOutlineGreen}`}>
              Browse Trips
            </Link>
          </div>

          <p className={styles.helpLine}>
            Need a hand on the trail? <a href="/home">Open live chat</a>.
          </p>
        </div>
        </section>
      </main>
    </>
  );
}

import type { CSSProperties } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Header } from "../components/Header";
import styles from "../style/payment-status.module.css";

function MountainIcon() {
  return (
    <svg width="58" height="58" viewBox="0 0 64 64" fill="none" aria-hidden="true">
      <path d="M7 50L25.5 17L38 38L45 28L57 50H7Z" fill="currentColor" opacity="0.95" />
      <path d="M25.5 17L31 26L25 24L20 28L25.5 17Z" fill="#F5EDD8" opacity="0.85" />
      <path d="M38 38L45 28L49 35L44 33L38 38Z" fill="#F5EDD8" opacity="0.7" />
      <path d="M12 50H54" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
    </svg>
  );
}

export default function PaymentSuccess() {
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get("session_id");
  const bookingId = searchParams.get("bookingId");

  return (
    <>
      <Header />
      <main
        className={styles.page}
        style={{
          "--hero-bg": "#2D5A1B",
          "--body-bg": "#F5EDD8",
          "--accent": "#E07B2A",
          "--badge-color": "#F5EDD8",
        } as CSSProperties}
      >
        <section className={styles.hero}>
          <div className={styles.heroInner}>
            <span className={styles.badge}>Booking confirmed</span>
            <div className={styles.iconRing}>
              <MountainIcon />
            </div>
            <h1 className={styles.title}>Summit Reached!</h1>
            <p className={styles.tagline}>Your adventure awaits - we'll see you on the trail.</p>
          </div>
        </section>

      <section className={styles.body}>
        <div className={styles.content}>
          <article className={styles.summaryCard} aria-labelledby="summary-title">
            <div className={styles.summaryHeader}>
              <div>
                <p className={styles.eyebrow}>Order summary</p>
                <h2 className={styles.cardTitle} id="summary-title">Adventure pass</h2>
              </div>
              {sessionId && <span className={styles.sessionId}>Stripe session: {sessionId}</span>}
            </div>

            <hr className={styles.divider} />

            <div className={styles.lineItems}>
              <div className={styles.lineItem}>
                <span className={styles.dot} style={{ "--dot": "#2D5A1B" } as CSSProperties} />
                <span className={styles.lineLabel}>Trail booking</span>
                <span className={styles.lineValue}>Confirmed</span>
              </div>
              <div className={styles.lineItem}>
                <span className={styles.dot} style={{ "--dot": "#E07B2A" } as CSSProperties} />
                <span className={styles.lineLabel}>Guide and safety support</span>
                <span className={styles.lineValue}>Included</span>
              </div>
              <div className={styles.lineItem}>
                <span className={styles.dot} style={{ "--dot": "#9FE1CB" } as CSSProperties} />
                <span className={styles.lineLabel}>Confirmation email</span>
                <span className={styles.lineValue}>Sent</span>
              </div>
            </div>

            <div className={styles.totalRow}>
              <span className={styles.dot} style={{ "--dot": "#2D5A1B" } as CSSProperties} />
              <span className={styles.lineLabel}>Total paid</span>
              <span className={styles.lineValue}>See receipt</span>
            </div>
          </article>

          <div className={styles.actions}>
            <Link to="/my-bookings" className={`${styles.button} ${styles.buttonGreen}`}>
              View My Trip
            </Link>
            <button className={`${styles.button} ${styles.buttonOutlineGreen}`} type="button" onClick={() => window.print()}>
              Download PDF
            </button>
          </div>

          {bookingId && (
            <Link to="/my-bookings" className={styles.passLink}>
              View my booking passes
            </Link>
          )}

          <div className={styles.metaHints} aria-label="Booking metadata">
            <span>Email confirmation sent</span>
            <span className={styles.metaDot}>•</span>
            <span>Departure date in your trip details</span>
            <span className={styles.metaDot}>•</span>
            <span>Traveller count confirmed</span>
          </div>
        </div>
        </section>
      </main>
    </>
  );
}

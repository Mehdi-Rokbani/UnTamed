import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Elements } from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";
import type { StripeElementsOptions } from "@stripe/stripe-js";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Header } from "../components/Header";
import { BookingExpirationTimer } from "../components/checkout/BookingExpirationTimer";
import { CheckoutSummaryCard } from "../components/checkout/CheckoutSummaryCard";
import { StripePaymentForm } from "../components/checkout/StripePaymentForm";
import { useAuth } from "../auth/auth.store";
import * as BookingApi from "../api/booking.api";
import type { BookingWithDetails, StripeElementsPaymentResponse } from "../api/booking.api";
import styles from "../style/checkout.module.css";

const stripePublishableKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY;
const stripePromise = stripePublishableKey && stripePublishableKey !== "pk_test_replace_me"
  ? loadStripe(stripePublishableKey)
  : null;

function getGuestNames(booking: BookingWithDetails, mainGuestName: string): string[] {
  const stored = Array.isArray(booking.guestNames) ? booking.guestNames : [];
  const names = stored.length === booking.numberOfPeople
    ? stored
    : [mainGuestName, ...stored];

  return Array.from({ length: Math.max(1, booking.numberOfPeople) }, (_, index) => (
    names[index]?.trim() || (index === 0 ? mainGuestName : "")
  ));
}

function isExpired(expiresAt?: string | null): boolean {
  if (!expiresAt) return false;
  const value = new Date(expiresAt).getTime();
  return Number.isFinite(value) && value <= Date.now();
}

function toMinor(value?: number | string | null): number | null {
  if (value == null || value === "") return null;
  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numeric)) return null;
  return Math.round(numeric * 100);
}

function formatTndMinor(amount?: number | null): string {
  if (amount == null || !Number.isFinite(amount)) return "-";
  return `${(amount / 100).toFixed(2)} TND`;
}

export default function UntamedCheckoutPage() {
  const { bookingId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [booking, setBooking] = useState<BookingWithDetails | null>(null);
  const [payment, setPayment] = useState<StripeElementsPaymentResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expired, setExpired] = useState(false);
  const hasCreatedPaymentIntentRef = useRef(false);
  const currentBookingIdRef = useRef<string | null>(null);
  const paymentClientSecretRef = useRef<string | null>(null);

  const mainGuestName = user?.username?.trim() || user?.email || "Main guest";
  const guestNames = useMemo(
    () => booking ? getGuestNames(booking, mainGuestName) : [],
    [booking, mainGuestName]
  );
  const expiresAt = payment?.expiresAt ?? booking?.expiresAt ?? null;
  const totalMinor = payment?.amount ?? toMinor(booking?.totalPrice);
  const totalLabel = formatTndMinor(totalMinor);

  const loadCheckout = useCallback(async () => {
    if (!bookingId) {
      setError("Booking ID is missing.");
      setLoading(false);
      return;
    }

    if (currentBookingIdRef.current !== bookingId) {
      currentBookingIdRef.current = bookingId;
      hasCreatedPaymentIntentRef.current = false;
      paymentClientSecretRef.current = null;
      setPayment(null);
      setExpired(false);
    }

    setLoading(true);
    setError(null);

    try {
      const bookings = await BookingApi.listMyBookingsWithDetails();
      const match = bookings.find((item) => item.id === bookingId) ?? null;

      if (!match) {
        setBooking(null);
        setError("This booking is not available for your account.");
        return;
      }

      setBooking(match);

      if (match.status === "COMPLETED") {
        navigate(`/payment/success?bookingId=${match.id}`, { replace: true });
        return;
      }

      if (match.status === "CANCELLED" || match.status === "EXPIRED") {
        setExpired(match.status === "EXPIRED");
        return;
      }

      if (isExpired(match.expiresAt)) {
        setExpired(true);
        return;
      }

      if (!stripePromise) {
        setError("Stripe publishable key is missing. Set VITE_STRIPE_PUBLISHABLE_KEY.");
        return;
      }

      if (paymentClientSecretRef.current || hasCreatedPaymentIntentRef.current) {
        return;
      }

      hasCreatedPaymentIntentRef.current = true;

      try {
        const paymentResponse = await BookingApi.createStripeElementsPayment(match.id);
        paymentClientSecretRef.current = paymentResponse.clientSecret;
        setPayment(paymentResponse);
        setExpired(isExpired(paymentResponse.expiresAt));
      } catch (err) {
        hasCreatedPaymentIntentRef.current = false;
        throw err;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load checkout.");
    } finally {
      setLoading(false);
    }
  }, [bookingId, navigate]);

  useEffect(() => {
    loadCheckout();
  }, [loadCheckout]);

  const elementsOptions = useMemo<StripeElementsOptions | undefined>(() => {
    if (!payment?.clientSecret) return undefined;
    return {
      clientSecret: payment.clientSecret,
      appearance: {
        theme: "stripe",
        variables: {
          colorPrimary: "#24513a",
          colorBackground: "#ffffff",
          colorText: "#1f2a24",
          colorDanger: "#b42318",
          borderRadius: "8px",
        },
      },
    };
  }, [payment?.clientSecret]);

  const unavailable = booking?.status === "CANCELLED" || booking?.status === "EXPIRED" || expired;

  return (
    <>
      <Header />
      <main className={styles.page}>
        <section className={styles.shell}>
          <div className={styles.topbar}>
            <span>Untamed checkout</span>
            <Link to="/my-bookings" className={styles.backLink}>Back to booking</Link>
          </div>

          {loading && <div className={styles.stateBox}>Preparing your secure checkout...</div>}

          {!loading && error && (
            <div className={styles.stateBox}>
              <h1>Checkout unavailable</h1>
              <p>{error}</p>
              <Link to="/my-bookings" className={styles.secondaryButton}>Return to My Bookings</Link>
            </div>
          )}

          {!loading && !error && booking && (
            <div className={styles.grid}>
              <CheckoutSummaryCard
                booking={booking}
                guestNames={guestNames}
                amount={payment?.amount}
              />

              <div className={styles.checkoutAside}>
                <BookingExpirationTimer expiresAt={expiresAt} onExpired={() => setExpired(true)} />

                <section className={styles.paymentCard} aria-labelledby="payment-title">
                  <div className={styles.paymentHeader}>
                    <span className={styles.eyebrow}>Payment details</span>
                    <h2 id="payment-title">Pay securely</h2>
                    <p>You won't leave the Untamed platform.</p>
                  </div>

                  <div className={styles.totalPill}>Total: {totalLabel}</div>

                  {unavailable && (
                    <div className={styles.warningBox}>
                      This booking has expired. Please start over.
                    </div>
                  )}

                  {!unavailable && stripePromise && elementsOptions && (
                    <Elements stripe={stripePromise} options={elementsOptions}>
                      <StripePaymentForm bookingId={booking.id} disabled={unavailable} totalLabel={totalLabel} />
                    </Elements>
                  )}
                </section>
              </div>
            </div>
          )}
        </section>
      </main>
    </>
  );
}

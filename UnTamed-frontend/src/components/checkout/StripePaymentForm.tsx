import { useState } from "react";
import type { FormEvent } from "react";
import { PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import styles from "../../style/checkout.module.css";

export function StripePaymentForm({
  bookingId,
  disabled,
  totalLabel,
}: {
  bookingId: string;
  disabled?: boolean;
  totalLabel: string;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!stripe || !elements || disabled || submitting) return;

    setSubmitting(true);
    setError(null);

    const result = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}/payment/success?bookingId=${bookingId}`,
      },
    });

    if (result.error) {
      setError(result.error.message || "Payment could not be confirmed.");
      setSubmitting(false);
    }
  }

  return (
    <form className={styles.paymentForm} onSubmit={onSubmit}>
      <PaymentElement />
      {error && <p className={styles.formError}>{error}</p>}
      <button className={styles.payButton} type="submit" disabled={!stripe || !elements || disabled || submitting}>
        {submitting ? "Processing..." : `Pay ${totalLabel} now`}
      </button>
      <p className={styles.secureNote}>Secured by Stripe · Untamed never stores card details</p>
    </form>
  );
}

import type { BookingWithDetails } from "../../api/booking.api";
import styles from "../../style/checkout.module.css";

function formatTndMinor(amount?: number | null): string {
  if (amount == null || !Number.isFinite(amount)) return "-";
  return `${(amount / 100).toFixed(2)} TND`;
}

function toMinor(value?: number | string | null): number | null {
  if (value == null || value === "") return null;
  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numeric)) return null;
  return Math.round(numeric * 100);
}

function formatSessionDate(value?: string | null): string {
  if (!value) return "Date to be announced";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Date to be announced";
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function initialsFor(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "G";
}

function statusLabel(status: BookingWithDetails["status"]): string {
  if (status === "PENDING") return "Pending payment";
  if (status === "PAYING") return "Payment in progress";
  if (status === "COMPLETED") return "Confirmed";
  if (status === "CANCELLED") return "Cancelled";
  return "Expired";
}

export function CheckoutSummaryCard({
  booking,
  guestNames,
  amount,
}: {
  booking: BookingWithDetails;
  guestNames: string[];
  amount?: number | null;
}) {
  const location = [booking.governorate, booking.locality].filter(Boolean).join(", ") || booking.displayName || "Location to be announced";
  const tags = [
    ...(booking.activityTags ?? []),
    ...(booking.categoryIds ?? []),
  ].filter(Boolean).slice(0, 4);
  const pricePerParticipant = toMinor(booking.pricePerPerson);
  const total = amount ?? toMinor(booking.totalPrice);

  return (
    <aside className={styles.summaryCard}>
      <div className={styles.imageFrame}>
        {booking.activityImageUrl ? (
          <img src={booking.activityImageUrl} alt="" />
        ) : (
          <div className={styles.imageFallback}>Untamed</div>
        )}
        <span className={styles.locationBadge}>{location}</span>
      </div>

      <div className={styles.summaryHeader}>
        <span className={styles.eyebrow}>Secure checkout</span>
        <h1>{booking.activityTitle || "Untamed adventure"}</h1>
        <div className={styles.tagRow}>
          {tags.length > 0 ? tags.map((tag) => <span key={tag}>{tag}</span>) : <span>Outdoor experience</span>}
          <strong>{statusLabel(booking.status)}</strong>
        </div>
      </div>

      <dl className={styles.summaryList}>
        <div>
          <dt>Date and time</dt>
          <dd>{formatSessionDate(booking.sessionStartAt)}</dd>
        </div>
        <div>
          <dt>Meeting point</dt>
          <dd>{booking.meetingPoint || "To be shared by the guide"}</dd>
        </div>
        <div>
          <dt>Participants</dt>
          <dd>{booking.numberOfPeople}</dd>
        </div>
      </dl>

      <section className={styles.guests} aria-labelledby="checkout-guests">
        <h2 id="checkout-guests">Guest names</h2>
        <ul>
          {guestNames.map((name, index) => (
            <li key={`${name}-${index}`}>
              <span>{initialsFor(name)}</span>
              <strong>{name || "Guest name missing"}</strong>
            </li>
          ))}
        </ul>
      </section>

      <dl className={styles.priceList}>
        <div>
          <dt>Price per participant</dt>
          <dd>{formatTndMinor(pricePerParticipant)}</dd>
        </div>
        <div>
          <dt>Platform fee</dt>
          <dd>0.00 TND</dd>
        </div>
        <div className={styles.totalLine}>
          <dt>Total</dt>
          <dd>{formatTndMinor(total)}</dd>
        </div>
      </dl>
    </aside>
  );
}

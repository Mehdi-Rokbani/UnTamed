// src/api/booking.api.ts
import { http } from "./http";
import type { MeetingPointLocation } from "../types/activity";

export type BookingStatus = "PENDING" | "PAYING" | "COMPLETED" | "EXPIRED" | "CANCELLED";
export type RefundStatus =
  | "NONE"
  | "NOT_REFUNDABLE"
  | "REFUND_PENDING"
  | "REFUNDED"
  | "PARTIALLY_REFUNDED"
  | "REFUND_FAILED";
export type CancelledBy = "USER" | "GUIDE" | "ADMIN" | "SYSTEM";

export type Booking = {
  id: string;
  userId: string;
  sessionId: string;
  numberOfPeople: number;
  status: BookingStatus;
  refundStatus?: RefundStatus;
  refundPercent?: number;
  refundAmount?: number;
  refundCurrency?: string | null;
  cancelledBy?: CancelledBy | null;
  cancellationReason?: string | null;
  cancelledAt?: string | null;
  stripeRefundId?: string | null;
  createdAt?: string;
  updatedAt?: string;
  expiresAt?: string | null;
};

export type RefundPreviewResponse = {
  refundable: boolean;
  refundPercent: number;
  refundAmount: number;
  currency?: string | null;
  refundStatus: RefundStatus;
  reason: string;
};

// ── Enriched booking returned by the new /api/bookings/mine/details endpoint ──
// If you have not yet added this backend endpoint, see the backend changes section
// in the deliverables note below. Until then, listMyBookingsWithDetails falls back
// to the basic /api/bookings/mine and leaves location fields null.
export type BookingWithDetails = Booking & {
  // Activity template info
  activityTemplateId?: string | null;
  guideId?: string | null;
  activityTitle: string | null;
  activityImageUrl: string | null;

  // Price info
  price?: number | string | null;
  unitPrice?: number | string | null;
  pricePerPerson?: number | string | null;
  activityPrice?: number | string | null;
  totalPrice?: number | string | null;
  priceTotal?: number | string | null;
  amountTotal?: number | string | null;
  bookingTotal?: number | string | null;
  currency?: string | null;

  // Session info
  sessionStartAt: string | null;
  meetingPoint?: string | null;
  meetingPointLocation?: MeetingPointLocation | null;
  activityTags?: string[];
  categoryIds?: string[];
  guestNames?: string[];

  // Address / location info
  displayName: string | null;
  governorate: string | null;
  locality: string | null;
  latitude: number | null;
  longitude: number | null;

  // Review eligibility from /api/bookings/mine/details
  reviewEligible?: boolean;
  alreadyReviewed?: boolean;
  reviewId?: string | null;
  reviewReason?: string | null;
};

export type CreateBookingRequest = {
  sessionId: string;
  numberOfPeople: number;
  guestNames?: string[];
};

export async function listMyBookings(): Promise<Booking[]> {
  const { data } = await http.get<Booking[]>("/api/bookings/mine", { withCredentials: true });
  return data;
}

/**
 * Fetches bookings enriched with session, template, and address details
 * (including lat/lng for map pins).
 *
 * Requires the new backend endpoint: GET /api/bookings/mine/details
 * which returns BookingWithDetails[].
 *
 * If the endpoint is not yet available this falls back to the basic
 * /mine endpoint and fills location fields with null.
 */
export async function listMyBookingsWithDetails(): Promise<BookingWithDetails[]> {
  try {
    const { data } = await http.get<BookingWithDetails[]>(
      "/api/bookings/mine/details",
      { withCredentials: true }
    );
    return data;
  } catch {
    // Graceful fallback: basic bookings without location data
    const basic = await listMyBookings();
    return basic.map((b) => ({
      ...b,
      activityTemplateId: null,
      guideId:            null,
      activityTitle:    null,
      activityImageUrl: null,
      pricePerPerson:   null,
      totalPrice:       null,
      currency:         "TND",
      sessionStartAt:   null,
      meetingPoint:     null,
      meetingPointLocation: null,
      activityTags:     [],
      categoryIds:      [],
      guestNames:       [],
      displayName:      null,
      governorate:      null,
      locality:         null,
      latitude:         null,
      longitude:        null,
      reviewEligible:   false,
      alreadyReviewed:  false,
      reviewId:         null,
      reviewReason:     null,
    }));
  }
}

export async function createOrIncreaseBooking(body: CreateBookingRequest): Promise<Booking> {
  const { data } = await http.post<Booking>("/api/bookings", body, { withCredentials: true });
  return data;
}

export async function increaseBookingSeats(bookingId: string, delta: number): Promise<Booking> {
  const { data } = await http.post<Booking>(
    `/api/bookings/${bookingId}/increase`,
    null,
    { params: { delta }, withCredentials: true }
  );
  return data;
}

export async function decreaseBookingSeats(bookingId: string, delta: number): Promise<Booking> {
  const { data } = await http.post<Booking>(
    `/api/bookings/${bookingId}/decrease`,
    null,
    { params: { delta }, withCredentials: true }
  );
  return data;
}

export async function cancelBooking(bookingId: string): Promise<{ bookingId: string; status: BookingStatus }> {
  const { data } = await http.post<{ bookingId: string; status: BookingStatus }>(
    `/api/bookings/${bookingId}/cancel`,
    null,
    { withCredentials: true }
  );
  return data;
}

export async function confirmBooking(bookingId: string): Promise<Booking> {
  const { data } = await http.post<Booking>(
    `/api/bookings/${bookingId}/confirm`,
    null,
    { withCredentials: true }
  );
  return data;
}

export type StripeCreatePaymentResponse = {
  checkoutUrl: string;
  sessionId: string;
};

export type StripeElementsPaymentResponse = {
  clientSecret: string;
  bookingId: string;
  amount: number;
  currency: string;
  expiresAt?: string | null;
  paymentAttemptId?: string | null;
  providerRef?: string | null;
};

export async function createStripePayment(bookingId: string): Promise<StripeCreatePaymentResponse> {
  const { data } = await http.post<StripeCreatePaymentResponse>(
    `/api/payments/stripe/create/${bookingId}`,
    null,
    { withCredentials: true }
  );
  return data;
}

export async function createStripeElementsPayment(bookingId: string): Promise<StripeElementsPaymentResponse> {
  const { data } = await http.post<StripeElementsPaymentResponse>(
    `/api/payments/stripe/elements/create/${bookingId}`,
    null,
    { withCredentials: true }
  );
  return data;
}

export async function cancelStripePayment(bookingId: string): Promise<void> {
  await http.post(
    `/api/payments/stripe/cancel/${bookingId}`,
    null,
    { withCredentials: true }
  );
}

export async function getRefundPreview(bookingId: string): Promise<RefundPreviewResponse> {
  const { data } = await http.get<RefundPreviewResponse>(
    `/api/bookings/${bookingId}/refund-preview`,
    { withCredentials: true }
  );
  return data;
}

export async function updateBookingGuestNames(bookingId: string, guestNames: string[]): Promise<Booking> {
  const { data } = await http.put<Booking>(
    `/api/bookings/${bookingId}/guests`,
    { guestNames },
    { withCredentials: true }
  );
  return data;
}

// src/api/booking.api.ts
import { http } from "./http";

export type BookingStatus = "PENDING" | "COMPLETED" | "EXPIRED" | "CANCELLED";

export type Booking = {
  id: string;
  userId: string;
  sessionId: string;
  numberOfPeople: number;
  status: BookingStatus;
  createdAt?: string;
  updatedAt?: string;
  expiresAt?: string | null;
};

export type CreateBookingRequest = {
  sessionId: string;
  numberOfPeople: number;
};

export async function listMyBookings() {
  const { data } = await http.get<Booking[]>("/api/bookings/mine", { withCredentials: true });
  return data;
}

export async function createOrIncreaseBooking(body: CreateBookingRequest) {
  const { data } = await http.post<Booking>("/api/bookings", body, { withCredentials: true });
  return data;
}

export async function increaseBookingSeats(bookingId: string, delta: number) {
  const { data } = await http.post<Booking>(
    `/api/bookings/${bookingId}/increase`,
    null,
    { params: { delta }, withCredentials: true }
  );
  return data;
}

export async function decreaseBookingSeats(bookingId: string, delta: number) {
  const { data } = await http.post<Booking>(
    `/api/bookings/${bookingId}/decrease`,
    null,
    { params: { delta }, withCredentials: true }
  );
  return data;
}

export async function cancelBooking(bookingId: string) {
  const { data } = await http.post<{ bookingId: string; status: BookingStatus }>(
    `/api/bookings/${bookingId}/cancel`,
    null,
    { withCredentials: true }
  );
  return data;
}
export async function confirmBooking(bookingId: string) {
  const { data } = await http.post<Booking>(
    `/api/bookings/${bookingId}/confirm`,
    null,
    { withCredentials: true }
  );
  return data;
}
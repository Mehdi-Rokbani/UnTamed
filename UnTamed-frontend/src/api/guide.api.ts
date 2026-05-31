import { http } from "./http";
import type { Participant } from "../types/guide";

export type Certificate = {
  id: string;
  title: string;
  issuer: string;
  credentialId?: string | null;
  issuedAt?: string | null;
  expiresAt?: string | null;
  verificationUrl?: string | null;
  fileUrl?: string | null;
  fileType?: string | null;
  fileSizeBytes?: number | null;
};

export type GuideProfileResponse = {
  experienceYears: number | null;
  certificates: Certificate[];
  ratingSummary?: { average: number; count: number } | null;
  verifiedBadge: boolean;
};

export type UpdateGuideProfilePayload = {
  experienceYears?: number | null;
};

export type GuideEarningsSummary = {
  grossCompletedBookingAmountMinor: number;
  platformCommissionMinor: number;
  guideEarningsMinor: number;
  pendingPayoutMinor: number;
  scheduledPayoutMinor: number;
  paidPayoutMinor: number;
  revenueRecords: number;
  payoutBatches: number;
};

export type GuideRevenueRecord = {
  id: string;
  bookingId: string;
  paymentAttemptId: string;
  sessionId: string;
  templateId: string;
  activityTitle?: string | null;
  grossAmountMinor: number;
  platformCommissionMinor: number;
  guidePayoutMinor: number;
  currency: string;
  status: string;
  bookingDate?: string | null;
  sessionStartAt?: string | null;
  payoutBatchId?: string | null;
  paidAt?: string | null;
};

export type GuidePayoutBatch = {
  id: string;
  periodStart?: string | null;
  periodEnd?: string | null;
  totalGrossMinor: number;
  totalCommissionMinor: number;
  totalPayoutMinor: number;
  currency: string;
  totalBookings: number;
  status: string;
  paidAt?: string | null;
};

export async function getGuideMe() {
  const { data } = await http.get<GuideProfileResponse>("/api/guides/me");
  return data;
}

export async function getGuideEarningsSummary() {
  const { data } = await http.get<GuideEarningsSummary>("/api/guides/me/earnings/summary");
  return data;
}

export async function getGuideRevenueRecords() {
  const { data } = await http.get<GuideRevenueRecord[]>("/api/guides/me/revenue-records");
  return data;
}

export async function getGuidePayouts() {
  const { data } = await http.get<GuidePayoutBatch[]>("/api/guides/me/payouts");
  return data;
}

export async function updateGuideMe(body: UpdateGuideProfilePayload) {
  const { data } = await http.patch<GuideProfileResponse>("/api/guides/me", body);
  return data;
}

export async function addCertificate(body: Omit<Certificate, "id">) {
  const { data } = await http.post<GuideProfileResponse>("/api/guides/me/certificates", body);
  return data;
}

export async function updateCertificate(certificateId: string, body: Partial<Omit<Certificate, "id">>) {
  const { data } = await http.patch<GuideProfileResponse>(`/api/guides/me/certificates/${certificateId}`, body);
  return data;
}

export async function deleteCertificate(certificateId: string) {
  const { data } = await http.delete<GuideProfileResponse>(`/api/guides/me/certificates/${certificateId}`);
  return data;
}

export async function getSessionParticipants(sessionId: string) {
  const { data } = await http.get<Participant[]>(
    `/api/guide/sessions/${sessionId}/participants`,
    { withCredentials: true }
  );
  return data;
}



export async function getSessionBookings(sessionId: string) {
  const { data } = await http.get<Participant[]>(
    `/api/guide/sessions/${sessionId}/bookings`,
    { withCredentials: true }
  );
  return data;
}

export async function cancelPendingBookingByGuide(bookingId: string) {
  const { data } = await http.post<{ bookingId: string; status: string }>(
    `/api/guide/sessions/bookings/${bookingId}/cancel-pending`,
    null,
    { withCredentials: true }
  );
  return data;
}

export async function removeGuideBooking(bookingId: string, reason: string) {
  const { data } = await http.post<{ bookingId: string; status: string }>(
    `/api/guide/sessions/bookings/${bookingId}/remove`,
    { reason },
    { withCredentials: true }
  );
  return data;
}

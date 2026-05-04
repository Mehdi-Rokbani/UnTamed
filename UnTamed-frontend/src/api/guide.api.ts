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

export async function getGuideMe() {
  const { data } = await http.get<GuideProfileResponse>("/api/guides/me");
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

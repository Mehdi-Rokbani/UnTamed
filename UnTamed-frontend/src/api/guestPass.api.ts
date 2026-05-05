import { http } from "./http";
import type { PaginatedResponse } from "../types/pagination";
import { toPaginatedResponse } from "../types/pagination";

export type GuestPassStatus = "ACTIVE" | "CANCELLED";
export type AttendanceStatus = "NOT_MARKED" | "PRESENT" | "ABSENT";

export type GuestPass = {
  id: string;
  bookingId: string;
  sessionId: string;
  activityTemplateId: string;
  guideId: string;
  token: string;
  passNumber: number;
  totalPasses: number;
  guestName: string;
  mainBooker: boolean;
  status: GuestPassStatus;
  attendanceStatus: AttendanceStatus;
  createdAt?: string;
  markedAt?: string | null;
  markedByGuideId?: string | null;
};

export type VerifyGuestPassResponse = {
  valid: boolean;
  message: string;
  guestPassId: string | null;
  bookingId: string | null;
  sessionId: string | null;
  activityTemplateId: string | null;
  guideId: string | null;
  passNumber: number;
  totalPasses: number;
  guestName: string | null;
  mainBooker: boolean;
  passStatus: GuestPassStatus | null;
  attendanceStatus: AttendanceStatus | null;
  activityTitle: string | null;
  sessionStartAt: string | null;
  numberOfPeople: number;
  present: boolean;
  absent: boolean;
  markedAt?: string | null;
  markedByGuideId?: string | null;
};

export type GuideGuestPassAttendance = {
  id: string;
  bookingId: string;
  sessionId: string;
  activityTemplateId: string;
  guideId: string;
  guestName: string;
  mainBooker: boolean;
  passNumber: number;
  totalPasses: number;
  status: GuestPassStatus;
  attendanceStatus: AttendanceStatus;
  activityTitle: string | null;
  sessionStartAt: string | null;
  createdAt?: string;
  markedAt?: string | null;
  markedByGuideId?: string | null;
};

export async function getGuestPassesForBooking(bookingId: string): Promise<GuestPass[]> {
  const { data } = await http.get<GuestPass[]>(
    `/api/guest-passes/booking/${bookingId}`,
    { withCredentials: true }
  );
  return data;
}

export async function getPublicGuestPass(token: string): Promise<VerifyGuestPassResponse> {
  const { data } = await http.get<VerifyGuestPassResponse>(
    `/api/guest-passes/public/${token}`,
    { withCredentials: true }
  );
  return data;
}

export async function verifyGuideGuestPass(token: string): Promise<VerifyGuestPassResponse> {
  const { data } = await http.get<VerifyGuestPassResponse>(
    `/api/guest-passes/guide/verify/${token}`,
    { withCredentials: true }
  );
  return data;
}

export async function markGuestPassPresent(token: string): Promise<VerifyGuestPassResponse> {
  const { data } = await http.post<VerifyGuestPassResponse>(
    `/api/guest-passes/present/${token}`,
    null,
    { withCredentials: true }
  );
  return data;
}

export async function markGuestPassAbsent(token: string): Promise<VerifyGuestPassResponse> {
  const { data } = await http.post<VerifyGuestPassResponse>(
    `/api/guest-passes/absent/${token}`,
    null,
    { withCredentials: true }
  );
  return data;
}

export async function getGuideSessionAttendance(sessionId: string): Promise<GuideGuestPassAttendance[]> {
  const { data } = await http.get<GuideGuestPassAttendance[]>(
    `/api/guest-passes/guide/session/${sessionId}/attendance`,
    { withCredentials: true }
  );
  return data;
}

export async function getGuideAttendanceHistory(): Promise<GuideGuestPassAttendance[]> {
  const { data } = await http.get<GuideGuestPassAttendance[]>(
    "/api/guest-passes/guide/history",
    { withCredentials: true }
  );
  return data;
}

export async function getGuideAttendanceHistoryPage(
  page = 0,
  size = 10
): Promise<PaginatedResponse<GuideGuestPassAttendance>> {
  const { data } = await http.get<
    GuideGuestPassAttendance[] | PaginatedResponse<GuideGuestPassAttendance>
  >(
    "/api/guest-passes/guide/history",
    {
      params: { page, size },
      withCredentials: true,
    }
  );

  return toPaginatedResponse(data, page, size);
}

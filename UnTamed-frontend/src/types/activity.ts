import type { AddressResponse } from "./geo";
import type { PaginatedResponse } from "./pagination";

export type Difficulty = "EASY" | "MEDIUM" | "HARD";

export type ActivityStatus =
  | "DRAFT"
  | "PUBLISHED"
  | "CANCELLED"
  | "COMPLETED";

export type RatingSummary = {
  average: number;
  count: number;
};

export type ActivityImage = {
  url: string;
  publicId?: string | null;
  alt?: string | null;
  cover: boolean;
  order: number;
};

export type AddressPickDto = {
  provider: string;
  providerPlaceId: string;
  displayName: string;
  governorate?: string | null;
  delegation?: string | null;
  locality?: string | null;
  latitude?: number | null;
  longitude?: number | null;
};

/** ---------------------------
 *  TEMPLATE
 *  ---------------------------
 */

export type ActivityTemplateCreatePayload = {
  title: string;
  description: string;
  difficulty: Difficulty;
  price: number;

  categoryIds: string[];

  tags?: string[];
  safetyNotes?: string[];
  address: AddressPickDto;

  images?: ActivityImage[];
};

export type ActivityTemplateUpdatePayload =
  Partial<ActivityTemplateCreatePayload>;

export type ActivityTemplateResponse = {
  id: string;
  title: string;
  description: string;
  difficulty: Difficulty;
  price: number;

  guideId: string;
  addressId: string;

  tags: string[];
  safetyNotes: string[];
  rating: RatingSummary;

  images: ActivityImage[];
  categoryIds: string[];

  archived: boolean;
  archivedAt?: string | null;

  createdAt?: string | null;
  updatedAt?: string | null;
};

export type ActivityTemplateDeleteAction =
  | "DELETED"
  | "DELETED_WITH_SESSIONS"
  | "DELETED_WITH_HISTORY"
  | "BLOCKED";

export type ActivityTemplateArchiveAction =
  | "ARCHIVED"
  | "ALREADY_ARCHIVED"
  | "BLOCKED";

export type ActivityTemplateDeleteResponse = {
  templateId: string;
  action: ActivityTemplateDeleteAction;
  message: string;
};

export type ActivityTemplateArchiveResponse = {
  templateId: string;
  action: ActivityTemplateArchiveAction;
  message: string;
};

/** ---------------------------
 *  SESSION
 *  ---------------------------
 */

export type ActivitySessionCreatePayload = {
  startAt: string;
  endAt: string;
  capacity: number;
  meetingPoint?: string | null;
  sessionNote?: string | null;
};

export type ActivitySessionUpdatePayload = {
  startAt?: string | null;
  endAt?: string | null;
  capacity?: number | null;
  status?: ActivityStatus | null;
  meetingPoint?: string | null;
  sessionNote?: string | null;
};

export type ActivitySessionDeleteAction =
  | "DELETED"
  | "CANCELLED"
  | "KEPT_HISTORY"
  | "BLOCKED";

export type ActivitySessionDeleteResponse = {
  sessionId: string;
  action: ActivitySessionDeleteAction;
  message: string;
};

export type ActivityTemplateMini = {
  id: string;
  title: string;
  price: number;
  difficulty: Difficulty;
  guideId: string;
  tags?: string[] | null;
  coverImageUrl?: string | null;
  categoryIds?: string[] | null;
};

export type ActivitySessionResponse = {
  id: string;
  templateId: string;
  guideId: string;

  startAt: string;
  endAt: string;
  capacity: number;
  bookedCount: number;
  status: ActivityStatus;
  meetingPoint?: string | null;
  sessionNote?: string | null;

  template?: ActivityTemplateMini | null;
  rating?: RatingSummary | null;
};

/** ---------------------------
 *  GUIDE SESSION DETAILS
 *  ---------------------------
 */

export type BookingStatus =
  | "PENDING"
  | "PAYING"
  | "COMPLETED"
  | "EXPIRED"
  | "CANCELLED";

export type GuestPassStatus = "ACTIVE" | "CANCELLED";
export type AttendanceStatus = "NOT_MARKED" | "PRESENT" | "ABSENT";
export type RefundStatus =
  | "NONE"
  | "NOT_REFUNDABLE"
  | "REFUND_PENDING"
  | "REFUNDED"
  | "PARTIALLY_REFUNDED"
  | "REFUND_FAILED";
export type CancelledBy = "USER" | "GUIDE" | "ADMIN" | "SYSTEM";

export type GuidePassAttendanceDto = {
  passId: string;
  bookingId: string;
  guestName: string | null;
  passNumber: number;
  totalPasses: number;
  mainBooker: boolean;
  status: GuestPassStatus;
  attendanceStatus: AttendanceStatus;
  markedAt?: string | null;
  markedByGuideId?: string | null;
};

export type GuideParticipantDto = {
  bookingId: string;
  userId: string;
  username?: string | null;
  email?: string | null;
  profileImageUrl?: string | null;
  numberOfPeople: number;
  status: BookingStatus;
  createdAt: string;
  totalAmount?: number;
  currency?: string | null;
  refundStatus?: RefundStatus;
  refundPercent?: number;
  refundAmount?: number;
  refundCurrency?: string | null;
  cancelledBy?: CancelledBy | null;
  cancellationReason?: string | null;
  cancelledAt?: string | null;
  passes?: GuidePassAttendanceDto[];
};

export type GuideAttendanceSummaryDto = {
  totalPasses: number;
  present: number;
  absent: number;
  notCheckedIn: number;
};

export type GuideSessionDetailsResponse = {
  session: ActivitySessionResponse;
  bookings: GuideParticipantDto[];
  totalBookings: number;
  totalPeople: number;
  pendingCount: number;
  payingCount: number;
  completedCount: number;
  cancelledCount: number;
  expiredCount: number;
  attendanceSummary?: GuideAttendanceSummaryDto;
};

export type GuideTemplateDashboardTemplate = {
  id: string;
  title: string;
  description: string;
  difficulty: Difficulty;
  price: number;
  images: ActivityImageDto[];
  coverImageUrl?: string | null;
  categoryIds: string[];
  categoryNames: string[];
  addressId?: string | null;
  addressDisplayName?: string | null;
  governorate?: string | null;
  locality?: string | null;
  archived: boolean;
  archivedAt?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
};

export type GuideTemplateSessionBookingSummary = {
  totalBookings: number;
  completedBookings: number;
  pendingBookings: number;
  payingBookings: number;
  cancelledBookings: number;
  expiredBookings: number;
  paidParticipants: number;
  totalParticipants: number;
};

export type GuideTemplateSessionAttendanceSummary = {
  totalPasses: number;
  presentCount: number;
  absentCount: number;
  pendingAttendanceCount: number;
};

export type GuideTemplateSessionDashboard = {
  sessionId: string;
  templateId: string;
  startAt: string;
  endAt: string;
  capacity: number;
  bookedCount: number;
  availableSpots: number;
  status: ActivityStatus;
  meetingPoint?: string | null;
  sessionNote?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  bookingSummary: GuideTemplateSessionBookingSummary;
  attendanceSummary: GuideTemplateSessionAttendanceSummary;
};

export type GuideTemplateSessionsSummary = {
  totalSessions: number;
  upcomingSessions: number;
  completedSessions: number;
  cancelledSessions: number;
  totalBookings: number;
  totalParticipants: number;
  totalRevenue: number;
  averageFillRate: number;
};

export type GuideTemplateSessionsDashboardResponse = {
  template: GuideTemplateDashboardTemplate;
  sessions: PaginatedResponse<GuideTemplateSessionDashboard>;
  summary: GuideTemplateSessionsSummary;
};

/** ---------------------------
 *  PUBLIC BROWSE
 *  ---------------------------
 */

export type PublicNextSession = {
  sessionId: string;
  date: string;
  capacity: number;
  bookedCount: number;
};

export type PublicSession = {
  id: string;
  startAt: string;
  endAt: string;
  capacity: number;
  bookedCount: number;
};

export type TemplateWithAddress = ActivityTemplateResponse & {
  address?: AddressResponse | null;
};

export type ActivityImageDto = {
  url: string;
  publicId?: string | null;
  alt?: string | null;
  cover: boolean;
  order: number;
};

export type PublicGuideDto = {
  id: string;
  username: string;
  profileImageUrl?: string | null;
  verifiedBadge: boolean;
  rating: RatingSummary;
  experienceYears?: number | null;
};

export type PublicTemplateCard = {
  id: string;
  title: string;
  description: string;
  difficulty: Difficulty;
  price: number;
  tags: string[];
  coverImageUrl?: string | null;
  rating: RatingSummary;
  nextSession?: PublicNextSession | null;
  upcomingSessionsCount: number;
  images: ActivityImageDto[];
  addressDisplayName?: string | null;
  governorate?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  totalBookedCount: number;
  guide?: PublicGuideDto | null;
};

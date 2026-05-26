export type ReportTargetType = "GUIDE" | "ACTIVITY" | "USER" | "SESSION";

export type ReportReason =
  | "FAKE_INFORMATION"
  | "INAPPROPRIATE_CONTENT"
  | "ABUSE_OR_HARASSMENT"
  | "SCAM_OR_FRAUD"
  | "SAFETY_CONCERN"
  | "NO_SHOW"
  | "PAYMENT_OR_BOOKING_ISSUE"
  | "SESSION_PROBLEM"
  | "OTHER";

export type ReportStatus = "PENDING" | "RESOLVED" | "REJECTED";

export type CreateReportRequest = {
  targetType: ReportTargetType;
  targetId: string;
  reason: ReportReason;
  description: string;
};

export type ReportResponse = {
  id: string;
  reporterId: string;
  reporterEmail?: string | null;
  reporterUsername?: string | null;
  targetType: ReportTargetType;
  targetId: string;
  reason: ReportReason;
  description: string;
  status: ReportStatus;
  reporterBookedTarget: boolean;
  reporterCompletedTarget: boolean;
  reporterHadChatWithTarget: boolean;
  reporterBelongsToSession: boolean;
  adminNote?: string | null;
  reviewedByAdminId?: string | null;
  createdAt?: string | null;
  reviewedAt?: string | null;
};

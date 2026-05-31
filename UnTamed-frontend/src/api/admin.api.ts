import { http } from "./http";

export type AdminHealthResponse = {
  status: string;
  message: string;
};

export type AdminStats = {
  totalUsers: number;
  totalAdventurers: number;
  totalGuides: number;
  pendingGuides: number;
  totalActivities: number;
  publishedActivities: number;
  totalSessions: number;
  publishedSessions: number;
  totalBookings: number;
  confirmedBookings: number;
  totalRevenue: number;
  pendingReviews: number;
};

export type PageResponse<T> = {
  content: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  last: boolean;
};

export type AdminPageParams = {
  page?: number;
  size?: number;
  query?: string;
  role?: string;
  status?: string;
};

export type AdminActivityParams = {
  page?: number;
  size?: number;
  query?: string;
  status?: string;
  category?: string;
};

export type AdminAuditLogParams = {
  page?: number;
  size?: number;
  query?: string;
  action?: string;
  targetType?: string;
  adminId?: string;
  targetId?: string;
  fromDate?: string;
  toDate?: string;
};

export type AdminAlertParams = {
  page?: number;
  size?: number;
  query?: string;
  type?: string;
  severity?: string;
  status?: string;
};

export type AdminReportParams = {
  page?: number;
  size?: number;
  status?: string;
  targetType?: string;
  reason?: string;
  sort?: string;
};

export type AdminUser = {
  id: string;
  username: string;
  email: string;
  role: string;
  verified: boolean;
  enabled: boolean;
  suspended: boolean;
  profileImageUrl?: string | null;
  createdAt: string;
  status: string;
};

export type AdminGuide = {
  id: string;
  username: string;
  email: string;
  role: string;
  verified: boolean;
  enabled: boolean;
  suspended: boolean;
  activitiesCount: number;
  rating: number;
  status: string;
  createdAt: string;
  bio?: string | null;
  profileImageUrl?: string | null;
  experienceYears?: number | null;
  ratingCount?: number | null;
  certificates: Array<{
    id?: string | null;
    title?: string | null;
    issuer?: string | null;
    credentialId?: string | null;
    issuedAt?: string | null;
    expiresAt?: string | null;
    verificationUrl?: string | null;
    fileUrl?: string | null;
    fileType?: string | null;
    fileSizeBytes?: number | null;
  }>;
};

export type GuideSuspensionImpact = {
  guideId: string;
  guideName: string;
  guideEmail: string;
  upcomingSessionsCount: number;
  confirmedBookingsCount: number;
  pendingBookingsCount: number;
  payingBookingsCount: number;
  estimatedPaidAmount: number;
  sessions: Array<{
    sessionId: string;
    activityTitle: string;
    startDateTime: string;
    status: string;
    confirmedBookingsCount: number;
    pendingBookingsCount: number;
    payingBookingsCount: number;
    paidAmount: number;
  }>;
};

export type AdminSession = {
  id: string;
  activityTitle: string;
  guideName: string;
  startDateTime: string;
  capacity: number;
  bookedCount: number;
  status: string;
};

export type AdminActivity = {
  id: string;
  title: string;
  category: string;
  location: string;
  guideId: string;
  guideName: string;
  guideEmail: string;
  coverImageUrl?: string | null;
  status: string;
  sessionsCount: number;
  publishedSessionsCount: number;
  createdAt: string;
};

export type AdminCancelSessionResponse = {
  sessionId: string;
  sessionStatus: string;
  affectedBookings: number;
  pendingCancelled: number;
  payingNeedsReview: number;
  paidNeedsRefund: number;
  usersNotified: number;
  notificationsFailed: number;
  message: string;
};

export type AdminRefundItem = {
  bookingId: string;
  userName: string;
  userEmail: string;
  activityTitle: string;
  sessionDate: string | null;
  amount: number;
  refundPercent: number;
  refundAmount: number;
  refundStatus: string;
  paymentIntentId?: string | null;
  cancelReason?: string | null;
  cancelledAt?: string | null;
  userNotified?: boolean;
  message?: string | null;
};

export type RevenueRecord = {
  id: string;
  bookingId: string;
  paymentAttemptId: string;
  sessionId: string;
  templateId: string;
  activityTitle?: string | null;
  guideId: string;
  guideName?: string | null;
  guideEmail?: string | null;
  userId: string;
  grossAmountMinor: number;
  platformCommissionMinor: number;
  guidePayoutMinor: number;
  currency: string;
  commissionRate: number;
  status: string;
  bookingDate?: string | null;
  sessionStartAt?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  sessionCompletedAt?: string | null;
  payoutBatchId?: string | null;
  paidAt?: string | null;
};

export type PayoutBatch = {
  id: string;
  guideId: string;
  guideName?: string | null;
  guideEmail?: string | null;
  periodStart?: string | null;
  periodEnd?: string | null;
  totalGrossMinor: number;
  totalCommissionMinor: number;
  totalPayoutMinor: number;
  currency: string;
  totalBookings: number;
  status: string;
  createdAt?: string | null;
  updatedAt?: string | null;
  paidAt?: string | null;
};

export type AdminRevenueSummary = {
  totalGrossMinor: number;
  totalPlatformCommissionMinor: number;
  totalGuidePayoutMinor: number;
  readyPayoutMinor: number;
  scheduledPayoutMinor: number;
  paidPayoutMinor: number;
  totalRevenueRecords: number;
  readyRecords: number;
  scheduledRecords: number;
  paidRecords: number;
  payoutBatches: number;
};

export type AdminAuditLog = {
  id: string;
  adminId?: string | null;
  adminEmail?: string | null;
  action: string;
  targetType: string;
  targetId: string;
  targetLabel?: string | null;
  reason?: string | null;
  details?: string | null;
  createdAt: string;
};

export type AdminAlert = {
  id: string;
  type: string;
  severity: string;
  title: string;
  description: string;
  entityType: string;
  entityId: string;
  route: string;
  status: string;
  createdAt: string | null;
};

export type AdminReportTargetSummary = {
  label?: string | null;
  username?: string | null;
  email?: string | null;
  role?: string | null;
  suspended?: boolean | null;
  activityTitle?: string | null;
  activityStatus?: string | null;
  sessionTemplateId?: string | null;
  sessionGuideId?: string | null;
  sessionStatus?: string | null;
  sessionStartAt?: string | null;
};

export type AdminReport = {
  id: string;
  reporterId: string;
  reporterEmail?: string | null;
  reporterUsername?: string | null;
  targetType: "GUIDE" | "ACTIVITY" | "USER" | "SESSION" | "ACCOUNT";
  targetId: string;
  reason:
    | "FAKE_INFORMATION"
    | "INAPPROPRIATE_CONTENT"
    | "ABUSE_OR_HARASSMENT"
    | "SCAM_OR_FRAUD"
    | "SAFETY_CONCERN"
    | "NO_SHOW"
    | "PAYMENT_OR_BOOKING_ISSUE"
    | "SESSION_PROBLEM"
    | "SUSPENSION_APPEAL"
    | "OTHER";
  description: string;
  status: "PENDING" | "RESOLVED" | "REJECTED";
  reporterBookedTarget: boolean;
  reporterCompletedTarget: boolean;
  reporterHadChatWithTarget: boolean;
  reporterBelongsToSession: boolean;
  adminNote?: string | null;
  reviewedByAdminId?: string | null;
  createdAt: string;
  reviewedAt?: string | null;
  target?: AdminReportTargetSummary | null;
};

export type AdminOverview = {
  stats: {
    totalUsers: number;
    totalAdventurers: number;
    totalGuides: number;
    pendingGuides: number;
    suspendedGuides: number;
    totalActivities: number;
    totalSessions: number;
    cancelledSessions: number;
    totalBookings: number;
    completedBookings: number;
    pendingRefunds: number;
    failedRefunds: number;
    pendingReports: number;
    pendingSuspensionAppeals: number;
    openAlerts: number;
    totalRevenue: number;
  };
  trends: Array<{
    date: string;
    newUsers: number;
    newBookings: number;
    revenue: number;
  }>;
  moderationPriorities: Array<{
    key: string;
    label: string;
    description: string;
    count: number;
    severity: string;
    route: string;
  }>;
  refundAlerts: Array<{
    bookingId: string;
    userEmail: string;
    activityTitle: string;
    sessionDate: string | null;
    refundAmount: number;
    refundStatus: string;
    cancelledAt: string | null;
    cancelReason: string | null;
    paymentIntentId: string | null;
  }>;
  sessionAlerts: Array<{
    sessionId: string;
    activityTitle: string;
    guideName: string;
    startDateTime: string | null;
    status: string | null;
    cancelledAt: string | null;
    cancelledBy: string | null;
    cancellationReason: string | null;
    payingNeedsReview: number;
    paidNeedsRefund: number;
  }>;
  reportStatusBuckets: Array<{
    status: string;
    count: number;
  }>;
  alertStatusBuckets: Array<{
    status: string;
    count: number;
  }>;
  recentUsers: Array<{
    id: string;
    username: string;
    email: string;
    role: string | null;
    profileImageUrl?: string | null;
    status: string;
    createdAt: string;
  }>;
  recentActivities: Array<{
    id: string;
    title: string;
    guideName: string;
    coverImageUrl?: string | null;
    status: string;
    createdAt: string;
  }>;
  recentSessions: Array<{
    id: string;
    activityTitle: string;
    guideName: string;
    startDateTime: string | null;
    status: string | null;
    bookedCount: number;
    capacity: number;
  }>;
  pendingGuides: Array<{
    id: string;
    username: string;
    email: string;
    createdAt: string;
  }>;
  pendingRefunds: Array<{
    bookingId: string;
    userEmail: string;
    activityTitle: string;
    refundAmount: number;
    refundStatus: string;
  }>;
  recentAuditLogs: Array<{
    id: string;
    adminEmail?: string | null;
    action: string;
    targetLabel?: string | null;
    createdAt: string;
  }>;
};

export async function getAdminHealth(): Promise<AdminHealthResponse> {
  const { data } = await http.get<AdminHealthResponse>("/api/admin/health");
  return data;
}

export async function getAdminStats(): Promise<AdminStats> {
  const { data } = await http.get<AdminStats>("/api/admin/stats");
  return data;
}

export async function getAdminOverview(): Promise<AdminOverview> {
  const { data } = await http.get<AdminOverview>("/api/admin/overview");
  return data;
}

export async function getAdminAlerts(params?: AdminAlertParams): Promise<PageResponse<AdminAlert>> {
  const { data } = await http.get<PageResponse<AdminAlert>>("/api/admin/alerts", { params });
  return data;
}

export async function getAdminReports(params?: AdminReportParams): Promise<PageResponse<AdminReport>> {
  const { data } = await http.get<PageResponse<AdminReport>>("/api/admin/reports", { params });
  return data;
}

export async function getAdminReport(id: string): Promise<AdminReport> {
  const { data } = await http.get<AdminReport>(`/api/admin/reports/${id}`);
  return data;
}

export async function resolveAdminReport(id: string, adminNote?: string): Promise<AdminReport> {
  const { data } = await http.patch<AdminReport>(`/api/admin/reports/${id}/resolve`, { adminNote });
  return data;
}

export async function rejectAdminReport(id: string, adminNote?: string): Promise<AdminReport> {
  const { data } = await http.patch<AdminReport>(`/api/admin/reports/${id}/reject`, { adminNote });
  return data;
}

export async function acknowledgeAdminAlert(id: string): Promise<AdminAlert> {
  const { data } = await http.patch<AdminAlert>(`/api/admin/alerts/${id}/acknowledge`);
  return data;
}

export async function resolveAdminAlert(id: string): Promise<AdminAlert> {
  const { data } = await http.patch<AdminAlert>(`/api/admin/alerts/${id}/resolve`);
  return data;
}

export async function reopenAdminAlert(id: string): Promise<AdminAlert> {
  const { data } = await http.patch<AdminAlert>(`/api/admin/alerts/${id}/reopen`);
  return data;
}

export async function getAdminUsers(params?: AdminPageParams): Promise<PageResponse<AdminUser>> {
  const { data } = await http.get<PageResponse<AdminUser>>("/api/admin/users", { params });
  return data;
}

export async function suspendUser(id: string): Promise<AdminUser> {
  const { data } = await http.patch<AdminUser>(`/api/admin/users/${id}/suspend`);
  return data;
}

export async function reactivateUser(id: string): Promise<AdminUser> {
  const { data } = await http.patch<AdminUser>(`/api/admin/users/${id}/reactivate`);
  return data;
}

export async function getAdminGuides(params?: AdminPageParams): Promise<PageResponse<AdminGuide>> {
  const { data } = await http.get<PageResponse<AdminGuide>>("/api/admin/guides", { params });
  return data;
}

export async function getGuideSuspensionImpact(guideId: string): Promise<GuideSuspensionImpact> {
  const { data } = await http.get<GuideSuspensionImpact>(`/api/admin/guides/${guideId}/suspension-impact`);
  return data;
}

export async function getAdminSessions(params?: AdminPageParams): Promise<PageResponse<AdminSession>> {
  const { data } = await http.get<PageResponse<AdminSession>>("/api/admin/sessions", { params });
  return data;
}

export async function getAdminActivities(params?: AdminActivityParams): Promise<PageResponse<AdminActivity>> {
  const { data } = await http.get<PageResponse<AdminActivity>>("/api/admin/activities", { params });
  return data;
}

export async function disableAdminActivity(id: string, reason: string): Promise<AdminActivity> {
  const { data } = await http.patch<AdminActivity>(`/api/admin/activities/${id}/disable`, { reason });
  return data;
}

export async function republishAdminActivity(id: string, reason?: string): Promise<AdminActivity> {
  const { data } = await http.patch<AdminActivity>(`/api/admin/activities/${id}/republish`, { reason });
  return data;
}

export async function cancelAdminSession(
  id: string,
  reason: string,
  notifyUsers = true,
): Promise<AdminCancelSessionResponse> {
  const { data } = await http.patch<AdminCancelSessionResponse>(`/api/admin/sessions/${id}/cancel`, {
    reason,
    notifyUsers,
  });
  return data;
}

export async function getPendingAdminRefunds(): Promise<AdminRefundItem[]> {
  const { data } = await http.get<AdminRefundItem[]>("/api/admin/refunds/pending");
  return data;
}

export async function getAdminRefunds(): Promise<AdminRefundItem[]> {
  const { data } = await http.get<AdminRefundItem[]>("/api/admin/refunds");
  return data;
}

export async function processAdminRefund(bookingId: string, notifyUser = true): Promise<AdminRefundItem> {
  const { data } = await http.post<AdminRefundItem>(`/api/admin/refunds/${bookingId}/process`, {
    notifyUser,
  });
  return data;
}

export async function getAdminRevenueSummary(): Promise<AdminRevenueSummary> {
  const { data } = await http.get<AdminRevenueSummary>("/api/admin/revenue/summary");
  return data;
}

export async function getAdminRevenueRecords(): Promise<RevenueRecord[]> {
  const { data } = await http.get<RevenueRecord[]>("/api/admin/revenue/records");
  return data;
}

export async function getAdminPayouts(): Promise<PayoutBatch[]> {
  const { data } = await http.get<PayoutBatch[]>("/api/admin/payouts");
  return data;
}

export async function markPayoutPaid(batchId: string): Promise<PayoutBatch> {
  const { data } = await http.post<PayoutBatch>(`/api/admin/payouts/${batchId}/mark-paid`);
  return data;
}

export async function getAdminAuditLogs(params?: AdminAuditLogParams): Promise<PageResponse<AdminAuditLog>> {
  const { data } = await http.get<PageResponse<AdminAuditLog>>("/api/admin/audit-logs", { params });
  return data;
}

export async function verifyGuide(id: string, payload?: { reason?: string }): Promise<AdminGuide> {
  const { data } = await http.patch<AdminGuide>(`/api/admin/guides/${id}/verify`, payload ?? {});
  return data;
}

export async function suspendGuide(
  id: string,
  payload?: { reason?: string; notifyGuide?: boolean },
): Promise<AdminGuide> {
  const { data } = await http.patch<AdminGuide>(`/api/admin/guides/${id}/suspend`, payload ?? {});
  return data;
}

export async function reactivateGuide(id: string, payload?: { notifyGuide?: boolean }): Promise<AdminGuide> {
  const { data } = await http.patch<AdminGuide>(`/api/admin/guides/${id}/reactivate`, payload ?? {});
  return data;
}

package com.untamed.untamedbackend.admin;

import java.time.Instant;
import java.util.List;

public record AdminOverviewResponse(
        Stats stats,
        List<TrendBucket> trends,
        List<ModerationPriority> moderationPriorities,
        List<RefundAlert> refundAlerts,
        List<SessionAlert> sessionAlerts,
        List<AlertStatusBucket> alertStatusBuckets,
        List<RecentUser> recentUsers,
        List<RecentActivity> recentActivities,
        List<RecentSession> recentSessions,
        List<PendingGuide> pendingGuides,
        List<PendingRefund> pendingRefunds,
        List<RecentAuditLog> recentAuditLogs
) {
    public record Stats(
            long totalUsers,
            long totalAdventurers,
            long totalGuides,
            long pendingGuides,
            long suspendedGuides,
            long totalActivities,
            long totalSessions,
            long cancelledSessions,
            long totalBookings,
            long completedBookings,
            long pendingRefunds,
            long failedRefunds,
            long openAlerts,
            double totalRevenue
    ) {}

    public record TrendBucket(
            String date,
            long newUsers,
            long newBookings,
            double revenue
    ) {}

    public record ModerationPriority(
            String key,
            String label,
            String description,
            long count,
            String severity,
            String route
    ) {}

    public record RefundAlert(
            String bookingId,
            String userEmail,
            String activityTitle,
            Instant sessionDate,
            double refundAmount,
            String refundStatus,
            Instant cancelledAt,
            String cancelReason,
            String paymentIntentId
    ) {}

    public record SessionAlert(
            String sessionId,
            String activityTitle,
            String guideName,
            Instant startDateTime,
            String status,
            Instant cancelledAt,
            String cancelledBy,
            String cancellationReason,
            long payingNeedsReview,
            long paidNeedsRefund
    ) {}

    public record AlertStatusBucket(
            String status,
            long count
    ) {}

    public record RecentUser(
            String id,
            String username,
            String email,
            String role,
            String profileImageUrl,
            String status,
            Instant createdAt
    ) {}

    public record RecentActivity(
            String id,
            String title,
            String guideName,
            String coverImageUrl,
            String status,
            Instant createdAt
    ) {}

    public record RecentSession(
            String id,
            String activityTitle,
            String guideName,
            Instant startDateTime,
            String status,
            int bookedCount,
            int capacity
    ) {}

    public record PendingGuide(
            String id,
            String username,
            String email,
            Instant createdAt
    ) {}

    public record PendingRefund(
            String bookingId,
            String userEmail,
            String activityTitle,
            double refundAmount,
            String refundStatus
    ) {}

    public record RecentAuditLog(
            String id,
            String adminEmail,
            String action,
            String targetLabel,
            Instant createdAt
    ) {}
}

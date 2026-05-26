package com.untamed.untamedbackend.report;

import java.time.Instant;

public record ReportResponse(
        String id,
        String reporterId,
        String reporterEmail,
        String reporterUsername,
        ReportTargetType targetType,
        String targetId,
        ReportReason reason,
        String description,
        ReportStatus status,
        boolean reporterBookedTarget,
        boolean reporterCompletedTarget,
        boolean reporterHadChatWithTarget,
        boolean reporterBelongsToSession,
        String adminNote,
        String reviewedByAdminId,
        Instant createdAt,
        Instant reviewedAt
) {
}

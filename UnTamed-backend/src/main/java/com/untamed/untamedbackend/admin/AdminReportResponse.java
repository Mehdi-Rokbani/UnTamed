package com.untamed.untamedbackend.admin;

import com.untamed.untamedbackend.report.ReportReason;
import com.untamed.untamedbackend.report.ReportStatus;
import com.untamed.untamedbackend.report.ReportTargetType;

import java.time.Instant;

public record AdminReportResponse(
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
        Instant reviewedAt,
        AdminReportTargetSummary target
) {
}

package com.untamed.untamedbackend.admin;

import java.time.Instant;

public record AdminReportTargetSummary(
        String label,
        String username,
        String email,
        String role,
        Boolean suspended,
        String activityTitle,
        String activityStatus,
        String sessionTemplateId,
        String sessionGuideId,
        String sessionStatus,
        Instant sessionStartAt
) {
}

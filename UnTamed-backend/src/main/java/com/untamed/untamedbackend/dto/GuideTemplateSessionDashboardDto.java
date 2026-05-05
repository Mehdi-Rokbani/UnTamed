package com.untamed.untamedbackend.dto;

import com.untamed.untamedbackend.model.ActivityStatus;

import java.time.Instant;

public record GuideTemplateSessionDashboardDto(
        String sessionId,
        String templateId,
        Instant startAt,
        Instant endAt,
        int capacity,
        int bookedCount,
        int availableSpots,
        ActivityStatus status,
        String meetingPoint,
        String sessionNote,
        Instant createdAt,
        Instant updatedAt,
        GuideTemplateSessionBookingSummaryDto bookingSummary,
        GuideTemplateSessionAttendanceSummaryDto attendanceSummary
) {}

package com.untamed.untamedbackend.dto;

public record GuideTemplateSessionAttendanceSummaryDto(
        int totalPasses,
        int presentCount,
        int absentCount,
        int pendingAttendanceCount
) {}

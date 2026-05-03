package com.untamed.untamedbackend.dto;

public record GuideAttendanceSummaryDto(
        int totalPasses,
        int present,
        int absent,
        int notCheckedIn
) {}

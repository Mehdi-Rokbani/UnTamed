package com.untamed.untamedbackend.dto;

public record ProfileTripAttendanceSummaryDto(
        int totalPasses,
        int present,
        int absent,
        int notMarked,
        int cancelled
) {}

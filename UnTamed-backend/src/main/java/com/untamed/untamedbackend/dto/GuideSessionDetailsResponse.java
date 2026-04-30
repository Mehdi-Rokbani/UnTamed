package com.untamed.untamedbackend.dto;

import java.util.List;

public record GuideSessionDetailsResponse(
        ActivitySessionResponse session,
        List<GuideParticipantDto> bookings,
        int totalBookings,
        int totalPeople,
        int pendingCount,
        int payingCount,
        int completedCount,
        int cancelledCount,
        int expiredCount
) {}
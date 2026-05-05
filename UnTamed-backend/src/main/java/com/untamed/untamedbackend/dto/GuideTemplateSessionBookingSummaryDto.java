package com.untamed.untamedbackend.dto;

public record GuideTemplateSessionBookingSummaryDto(
        int totalBookings,
        int completedBookings,
        int pendingBookings,
        int payingBookings,
        int cancelledBookings,
        int expiredBookings,
        int paidParticipants,
        int totalParticipants
) {}

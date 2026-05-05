package com.untamed.untamedbackend.dto;

import java.math.BigDecimal;

public record GuideTemplateSessionsSummaryDto(
        long totalSessions,
        long upcomingSessions,
        long completedSessions,
        long cancelledSessions,
        int totalBookings,
        int totalParticipants,
        BigDecimal totalRevenue,
        double averageFillRate
) {}

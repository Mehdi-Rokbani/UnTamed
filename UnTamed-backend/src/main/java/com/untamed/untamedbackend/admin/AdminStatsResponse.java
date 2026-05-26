package com.untamed.untamedbackend.admin;

public record AdminStatsResponse(
        long totalUsers,
        long totalAdventurers,
        long totalGuides,
        long pendingGuides,
        long totalActivities,
        long publishedActivities,
        long totalSessions,
        long publishedSessions,
        long totalBookings,
        long confirmedBookings,
        double totalRevenue,
        long pendingReviews
) {}

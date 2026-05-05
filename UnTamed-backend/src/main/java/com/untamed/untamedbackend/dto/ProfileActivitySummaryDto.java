package com.untamed.untamedbackend.dto;

public record ProfileActivitySummaryDto(
        long completedTripsCount,
        long reviewsCount,
        String favoriteCategory,
        int totalPeople
) {}

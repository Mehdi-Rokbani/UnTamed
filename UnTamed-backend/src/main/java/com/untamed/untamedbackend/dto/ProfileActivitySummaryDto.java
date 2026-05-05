package com.untamed.untamedbackend.dto;

import com.untamed.untamedbackend.model.Level;

public record ProfileActivitySummaryDto(
        long completedTripsCount,
        long reviewsCount,
        String favoriteCategory,
        int totalPeople,

        Level level,
        int xp,
        int levelNumber,
        String levelTitle,
        int xpToNextLevel,
        int levelProgressPercent
) {}
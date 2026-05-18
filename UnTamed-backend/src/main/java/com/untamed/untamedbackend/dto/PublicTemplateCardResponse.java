package com.untamed.untamedbackend.dto;

import com.untamed.untamedbackend.model.Difficulty;

import java.math.BigDecimal;
import java.util.List;

public record PublicTemplateCardResponse(
        String id,
        String title,
        String description,
        Difficulty difficulty,
        BigDecimal price,
        List<String> tags,
        List<String> categoryIds,
        List<String> categoryNames,
        String coverImageUrl,
        RatingSummaryDto rating,
        PublicNextSessionDto nextSession,
        int upcomingSessionsCount,
        // ── NEW ──
        List<ActivityImageDto> images,
        String addressDisplayName,
        String governorate,
        Double latitude,
        Double longitude,
        int totalBookedCount,
        PublicGuideDto guide
) {}

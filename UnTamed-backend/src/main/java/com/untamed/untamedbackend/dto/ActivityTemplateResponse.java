package com.untamed.untamedbackend.dto;

import com.untamed.untamedbackend.model.Difficulty;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

public record ActivityTemplateResponse(
        String id,
        String title,
        String description,
        Difficulty difficulty,
        BigDecimal price,

        String guideId,
        String addressId,

        List<String> tags,
        RatingSummaryDto rating,
        List<ActivityImageDto> images,
        List<String> categoryIds,

        Instant createdAt,
        Instant updatedAt
) {}
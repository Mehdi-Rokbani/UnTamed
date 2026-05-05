package com.untamed.untamedbackend.dto;

import com.untamed.untamedbackend.model.Difficulty;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

public record GuideTemplateDashboardTemplateDto(
        String id,
        String title,
        String description,
        Difficulty difficulty,
        BigDecimal price,
        List<ActivityImageDto> images,
        String coverImageUrl,
        List<String> categoryIds,
        List<String> categoryNames,
        String addressId,
        String addressDisplayName,
        String governorate,
        String locality,
        boolean archived,
        Instant archivedAt,
        Instant createdAt,
        Instant updatedAt
) {}

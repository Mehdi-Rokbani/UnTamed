// src/main/java/com/untamed/untamedbackend/dto/ActivityResponse.java
package com.untamed.untamedbackend.dto;

import com.untamed.untamedbackend.model.ActivityStatus;
import com.untamed.untamedbackend.model.Difficulty;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

public record ActivityResponse(
        String id,
        String title,
        String description,
        Difficulty difficulty,
        BigDecimal price,
        Instant date,
        int capacity,

        // Backward compatibility for your current frontend:
        boolean published,

        String guideId,
        String addressId,
        AddressPickDto address,

        // New fields:
        int bookedCount,
        List<String> tags,
        RatingSummaryDto rating,
        ActivityStatus status,
        List<ActivityImageDto> images,
        List<String> categoryIds,
        Instant createdAt,
        Instant updatedAt
) {}

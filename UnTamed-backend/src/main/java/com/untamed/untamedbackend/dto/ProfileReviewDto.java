package com.untamed.untamedbackend.dto;

import java.time.Instant;

public record ProfileReviewDto(
        String reviewId,
        String bookingId,
        String templateId,
        String activityTitle,
        String activityImageUrl,
        String governorate,
        int rating,
        String comment,
        Instant createdAt
) {}

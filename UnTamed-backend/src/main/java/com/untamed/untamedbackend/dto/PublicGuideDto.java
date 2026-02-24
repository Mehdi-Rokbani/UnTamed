package com.untamed.untamedbackend.dto;

public record PublicGuideDto(
        String id,
        String username,
        String profileImageUrl,
        boolean verifiedBadge,
        RatingSummaryDto rating,
        Integer experienceYears
) {}
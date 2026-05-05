package com.untamed.untamedbackend.dto;

public record UserGuideProfileResponse(
        Boolean verifiedBadge,
        Integer experienceYears,
        RatingSummaryResponse ratingSummary,
        Integer certificateCount
) {
    public record RatingSummaryResponse(
            Double average,
            Integer count
    ) {}
}

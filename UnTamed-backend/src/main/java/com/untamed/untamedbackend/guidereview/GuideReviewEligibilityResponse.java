package com.untamed.untamedbackend.guidereview;

public record GuideReviewEligibilityResponse(
        boolean eligible,
        boolean alreadyReviewed,
        String existingReviewId,
        String reason
) {}

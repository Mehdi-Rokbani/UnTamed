package com.untamed.untamedbackend.dto;

import com.untamed.untamedbackend.review.ReviewResponse;

public record PublicActivityReviewStateDto(
        ReviewResponse myReview,
        boolean reviewEligible,
        boolean alreadyReviewed,
        String reviewId,
        String reviewReason
) {}

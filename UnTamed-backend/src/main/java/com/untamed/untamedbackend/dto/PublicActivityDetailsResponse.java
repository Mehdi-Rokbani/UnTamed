package com.untamed.untamedbackend.dto;

import com.untamed.untamedbackend.booking.ParticipantsPreviewResponse;
import com.untamed.untamedbackend.recommendation.dto.RecommendationItemResponse;
import com.untamed.untamedbackend.review.ReviewResponse;

import java.util.List;

public record PublicActivityDetailsResponse(
        PublicTemplateCardResponse template,
        List<PublicSessionDto> upcomingSessions,
        RatingSummaryDto reviewsSummary,
        PaginatedResponse<ReviewResponse> reviews,
        PublicActivityReviewStateDto currentUserReview,
        ParticipantsPreviewResponse participantsPreview,
        List<RecommendationItemResponse> similarActivities,
        List<RecommendationItemResponse> recommendations
) {}

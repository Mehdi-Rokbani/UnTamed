package com.untamed.untamedbackend.dto;

import com.untamed.untamedbackend.model.Difficulty;
import com.untamed.untamedbackend.model.Level;
import com.untamed.untamedbackend.model.Role;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

public record PublicUserProfileResponse(
        String id,
        String username,
        Role role,
        String profileImageUrl,
        String bio,
        Instant createdAt,
        Level level,
        Integer levelNumber,
        String levelTitle,
        Integer levelProgressPercent,
        Integer confirmedTripsCount,
        Integer reviewsWrittenCount,
        List<PublicTopCategoryDto> topCategories,
        List<PublicUserActivityReviewDto> recentReviews,
        PublicUserGuideProfileDto guideProfile,
        List<PublicGuideReviewDto> guideReviews,
        List<PublicGuideActivityCardDto> guideActivities,
        PublicGuideStatsDto guideStats
) {
    public record PublicTopCategoryDto(
            String categoryId,
            String categoryName,
            int count
    ) {}

    public record PublicUserActivityReviewDto(
            String id,
            String activityTemplateId,
            String activityTitle,
            String activityImageUrl,
            Integer rating,
            String comment,
            Instant createdAt
    ) {}

    public record PublicUserGuideProfileDto(
            Boolean verifiedBadge,
            Integer experienceYears,
            RatingSummaryDto ratingSummary,
            Integer certificateCount,
            List<PublicCertificateDto> certificates
    ) {}

    public record PublicCertificateDto(
            String id,
            String title,
            String issuer,
            Instant issuedAt,
            Instant expiresAt,
            String verificationUrl
    ) {}

    public record PublicGuideReviewDto(
            String id,
            String reviewerUsername,
            String reviewerProfileImageUrl,
            Level reviewerLevel,
            String reviewerLevelTitle,
            Integer rating,
            String comment,
            Instant createdAt
    ) {}

    public record PublicGuideActivityCardDto(
            String id,
            String title,
            String coverImageUrl,
            BigDecimal price,
            Difficulty difficulty,
            List<String> categoryNames,
            String location,
            String governorate,
            RatingSummaryDto rating
    ) {}

    public record PublicGuideStatsDto(
            int activitiesCount,
            long upcomingSessionsCount,
            int totalReviewsCount,
            double averageRating
    ) {}
}

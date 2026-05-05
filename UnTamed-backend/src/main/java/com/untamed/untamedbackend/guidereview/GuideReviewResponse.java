package com.untamed.untamedbackend.guidereview;

import com.untamed.untamedbackend.model.Level;
import com.untamed.untamedbackend.model.ReviewStatus;

import java.time.Instant;

public record GuideReviewResponse(
        String id,
        String guideId,
        String reviewerId,
        String bookingId,
        String sessionId,
        int rating,
        String comment,
        ReviewStatus status,
        ReviewerSummary reviewer,
        Instant createdAt,
        Instant updatedAt
) {
    public record ReviewerSummary(
            String id,
            String username,
            String profileImageUrl,
            Level level
    ) {}
}

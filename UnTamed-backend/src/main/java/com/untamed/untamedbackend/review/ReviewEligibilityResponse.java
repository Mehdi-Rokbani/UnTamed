package com.untamed.untamedbackend.review;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class ReviewEligibilityResponse {
    private boolean eligible;
    private boolean alreadyReviewed;
    private String existingReviewId;
    private String activityTemplateId;
    private String reason;
}
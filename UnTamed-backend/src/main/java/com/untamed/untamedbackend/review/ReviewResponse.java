package com.untamed.untamedbackend.review;

import com.untamed.untamedbackend.model.ReviewStatus;
import lombok.Builder;
import lombok.Data;

import java.time.Instant;

@Data
@Builder
public class ReviewResponse {
    private String id;
    private String activityTemplateId;
    private String sessionId;
    private String bookingId;
    private String reviewerId;
    private String guideId;
    private int rating;
    private String comment;
    private ReviewStatus status;
    private String replyText;
    private Instant replyCreatedAt;
    private Instant replyUpdatedAt;
    private Instant createdAt;
    private Instant updatedAt;
}
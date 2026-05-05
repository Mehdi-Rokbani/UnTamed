package com.untamed.untamedbackend.model;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import lombok.*;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.Id;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.index.CompoundIndexes;
import org.springframework.data.mongodb.core.mapping.Document;
import org.springframework.data.mongodb.core.mapping.Field;

import java.time.Instant;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@Document(collection = "reviews")
@CompoundIndexes({
        @CompoundIndex(
                name = "uniq_reviewer_template",
                def = "{'reviewer_id': 1, 'activity_template_id': 1}",
                unique = true
        ),
        @CompoundIndex(
                name = "idx_template_status_created",
                def = "{'activity_template_id': 1, 'status': 1, 'created_at': -1}"
        ),
        @CompoundIndex(
                name = "idx_guide_created",
                def = "{'guide_id': 1, 'created_at': -1}"
        ),
        @CompoundIndex(
                name = "idx_reviewer_created",
                def = "{'reviewer_id': 1, 'created_at': -1}"
        ),
        @CompoundIndex(
                name = "idx_reviewer_booking",
                def = "{'reviewer_id': 1, 'booking_id': 1}"
        ),
        @CompoundIndex(
                name = "idx_booking",
                def = "{'booking_id': 1}"
        )
})
public class Review {

    @Id
    private String id;

    @NotBlank
    @Field("activity_template_id")
    private String activityTemplateId;

    @NotBlank
    @Field("session_id")
    private String sessionId;

    @NotBlank
    @Field("booking_id")
    private String bookingId;

    @NotBlank
    @Field("reviewer_id")
    private String reviewerId;

    @NotBlank
    @Field("guide_id")
    private String guideId;

    @Min(1)
    @Max(5)
    private int rating;

    @NotBlank
    private String comment;

    @Builder.Default
    private ReviewStatus status = ReviewStatus.VISIBLE;

    @Field("reply_text")
    private String replyText;

    @Field("reply_created_at")
    private Instant replyCreatedAt;

    @Field("reply_updated_at")
    private Instant replyUpdatedAt;

    @Field("reply_by_guide_id")
    private String replyByGuideId;

    @CreatedDate
    @Field("created_at")
    private Instant createdAt;

    @LastModifiedDate
    @Field("updated_at")
    private Instant updatedAt;
}

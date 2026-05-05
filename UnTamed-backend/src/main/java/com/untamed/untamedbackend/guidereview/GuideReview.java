package com.untamed.untamedbackend.guidereview;

import com.untamed.untamedbackend.model.ReviewStatus;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
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
@Document(collection = "guide_reviews")
@CompoundIndexes({
        @CompoundIndex(name = "idx_guide_created", def = "{'guide_id': 1, 'created_at': -1}"),
        @CompoundIndex(name = "idx_reviewer_created", def = "{'reviewer_id': 1, 'created_at': -1}"),
        @CompoundIndex(name = "idx_booking", def = "{'booking_id': 1}"),
        @CompoundIndex(
                name = "uniq_reviewer_guide_booking",
                def = "{'reviewer_id': 1, 'guide_id': 1, 'booking_id': 1}",
                unique = true
        )
})
public class GuideReview {

    @Id
    private String id;

    @NotBlank
    @Field("guide_id")
    private String guideId;

    @NotBlank
    @Field("reviewer_id")
    private String reviewerId;

    @NotBlank
    @Field("booking_id")
    private String bookingId;

    @NotBlank
    @Field("session_id")
    private String sessionId;

    @Min(1)
    @Max(5)
    private int rating;

    @NotBlank
    @Size(max = 1000)
    private String comment;

    @Builder.Default
    private ReviewStatus status = ReviewStatus.VISIBLE;

    @CreatedDate
    @Field("created_at")
    private Instant createdAt;

    @LastModifiedDate
    @Field("updated_at")
    private Instant updatedAt;
}

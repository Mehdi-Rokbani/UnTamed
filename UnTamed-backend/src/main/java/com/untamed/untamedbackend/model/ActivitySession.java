package com.untamed.untamedbackend.model;

import jakarta.validation.constraints.*;
import lombok.*;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.Id;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.mongodb.core.index.*;
import org.springframework.data.mongodb.core.mapping.Document;
import org.springframework.data.mongodb.core.mapping.Field;

import java.time.Instant;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@Document(collection = "activity_sessions")
@CompoundIndexes({
        @CompoundIndex(name = "idx_status_startAt", def = "{'status': 1, 'start_at': 1}"),
        @CompoundIndex(name = "idx_template_status_startAt", def = "{'template_id': 1, 'status': 1, 'start_at': 1}"),
        @CompoundIndex(name = "idx_guide_status_startAt", def = "{'guide_id': 1, 'status': 1, 'start_at': 1}"),
        @CompoundIndex(name = "idx_guide_startAt", def = "{'guide_id': 1, 'start_at': 1}"),
        @CompoundIndex(name = "idx_template_startAt", def = "{'template_id': 1, 'start_at': 1}"),
        @CompoundIndex(name = "uniq_template_startAt", def = "{'template_id': 1, 'start_at': 1}", unique = true)
})
public class ActivitySession {

    @Id
    private String id;

    @NotBlank
    @Indexed
    @Field("template_id")
    private String templateId;

    // denormalized for fast guide dashboard filters
    @NotBlank
    @Indexed
    @Field("guide_id")
    private String guideId;

    @NotNull
    @Indexed
    @Future
    @Field("start_at")
    private Instant startAt;

    @NotNull
    @Field("end_at")
    private Instant endAt;

    @Min(1)
    private int capacity;

    @Builder.Default
    private int bookedCount = 0;

    @NotNull
    @Indexed
    private ActivityStatus status;

    @Size(max = 300)
    private String meetingPoint;

    @Size(max = 1000)
    private String sessionNote;

    @CreatedDate
    private Instant createdAt;

    @LastModifiedDate
    private Instant updatedAt;
}

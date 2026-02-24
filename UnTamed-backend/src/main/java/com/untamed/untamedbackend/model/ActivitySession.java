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
        @CompoundIndex(name = "idx_status_date", def = "{'status': 1, 'date': 1}"),
        @CompoundIndex(name = "idx_template_status_date", def = "{'template_id': 1, 'status': 1, 'date': 1}"),
        @CompoundIndex(name = "idx_guide_status_date", def = "{'guide_id': 1, 'status': 1, 'date': 1}"),
        @CompoundIndex(name="uniq_template_date", def="{'template_id': 1, 'date': 1}", unique = true)
})
public class ActivitySession {

    @Id
    private String id;

    @NotBlank
    @Indexed
    @Field("template_id")
    private String templateId;

    // denormalize for fast guide dashboard filters (optional but useful)
    @NotBlank
    @Indexed
    @Field("guide_id")
    private String guideId;

    @NotNull
    @Indexed
    @Future
    private Instant date;

    @Min(1)
    private int capacity;

    @Builder.Default
    private int bookedCount = 0;

    @NotNull
    @Indexed
    private ActivityStatus status;

    @CreatedDate
    private Instant createdAt;

    @LastModifiedDate
    private Instant updatedAt;
}
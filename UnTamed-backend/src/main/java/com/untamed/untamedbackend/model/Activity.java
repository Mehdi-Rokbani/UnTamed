// src/main/java/com/untamed/untamedbackend/model/Activity.java
package com.untamed.untamedbackend.model;

import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import lombok.*;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.Id;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.mongodb.core.geo.GeoJsonPoint;
import org.springframework.data.mongodb.core.index.*;
import org.springframework.data.mongodb.core.mapping.Document;
import org.springframework.data.mongodb.core.mapping.Field;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@Document(collection = "activities")
@CompoundIndexes({
        @CompoundIndex(name = "idx_status_date", def = "{'status': 1, 'date': 1}"),
        @CompoundIndex(name = "idx_guide_status_date", def = "{'guide_id': 1, 'status': 1, 'date': 1}")
})
public class Activity {

    @Id
    private String id;

    @NotBlank
    @Indexed
    private String title;

    @NotBlank
    private String description;

    @NotNull
    @Indexed
    private Difficulty difficulty;

    @PositiveOrZero
    private BigDecimal price;

    @NotNull
    @Future
    @Indexed
    private Instant date;

    @Min(1)
    private int capacity;

    // booking count
    @Builder.Default
    private int bookedCount = 0;

    // activity status
    @NotNull
    @Indexed
    private ActivityStatus status;

    // tags
    @Builder.Default
    @Indexed
    private List<@NotBlank String> tags = List.of();

    // rating summary
    @Builder.Default
    private RatingSummary rating = RatingSummary.builder().average(0.0).count(0).build();

    // images
    @Builder.Default
    private List<@Valid ActivityImage> images= List.of();

    // categories (reference by IDs)
    @NotEmpty
    @Indexed
    @Field("category_ids")
    private List<@NotBlank String> categoryIds;

    @NotBlank
    @Indexed
    @Field("guide_id")
    private String guideId;

    @NotBlank
    @Indexed
    @Field("address_id")
    private String addressId;

    // Optional: store a geo point snapshot for “nearby activities” queries without joining Address
    @GeoSpatialIndexed(type = GeoSpatialIndexType.GEO_2DSPHERE)
    private GeoJsonPoint location;

    // created / updated timestamps
    @CreatedDate
    private Instant createdAt;

    @LastModifiedDate
    private Instant updatedAt;
}

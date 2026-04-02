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
@Document(collection = "activity_templates")
@CompoundIndexes({
        @CompoundIndex(name = "idx_guide", def = "{'guide_id': 1}"),
        @CompoundIndex(name = "idx_categories", def = "{'category_ids': 1}")
})
public class ActivityTemplate {

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

    @Builder.Default
    @Indexed
    private List<@NotBlank String> tags = List.of();

    @Builder.Default
    private List<@Valid ActivityImage> images = List.of(); // Cloudinary stays same

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

    @GeoSpatialIndexed(type = GeoSpatialIndexType.GEO_2DSPHERE)
    private GeoJsonPoint location;

    // ✅ rating belongs here
    @Builder.Default
    private RatingSummary rating = RatingSummary.builder().average(0.0).count(0).build();

    @CreatedDate
    private Instant createdAt;

    @LastModifiedDate
    private Instant updatedAt;


}
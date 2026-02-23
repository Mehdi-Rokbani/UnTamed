// src/main/java/com/untamed/untamedbackend/model/Address.java
package com.untamed.untamedbackend.model;

import jakarta.validation.constraints.*;
import lombok.*;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.Id;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.mongodb.core.index.*;
import org.springframework.data.mongodb.core.mapping.Document;
import org.springframework.data.mongodb.core.geo.GeoJsonPoint;

import java.time.Instant;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@Document(collection = "addresses")
@CompoundIndexes({
        @CompoundIndex(name = "uniq_provider_place", def = "{'provider': 1, 'providerPlaceId': 1}", unique = true),
        @CompoundIndex(name = "idx_admin_parts", def = "{'governorate': 1, 'delegation': 1, 'locality': 1}")
})
public class Address {

    @Id
    private String id;

    // e.g. "locationiq" (future-proof if you add other providers)
    @NotBlank
    @Indexed
    private String provider;

    // LocationIQ place_id (best dedupe key)
    @NotBlank
    private String providerPlaceId;

    @NotBlank
    private String displayName;

    // Optional admin parts (depends on reverse/forward response quality)
    private String governorate;
    private String delegation;
    private String locality;

    @NotNull
    @DecimalMin("-90.0") @DecimalMax("90.0")
    private Double latitude;

    @NotNull
    @DecimalMin("-180.0") @DecimalMax("180.0")
    private Double longitude;

    // For geo queries (IMPORTANT: GeoJsonPoint is (lon, lat))
    @GeoSpatialIndexed(type = GeoSpatialIndexType.GEO_2DSPHERE)
    private GeoJsonPoint location;

    // Optional fallback dedupe key (rounded coords) if providerPlaceId is missing/unstable
    @Indexed
    private String normalizedKey;

    @Builder.Default
    private long usesCount = 0;

    @CreatedDate
    private Instant createdAt;

    @LastModifiedDate
    private Instant updatedAt;
}

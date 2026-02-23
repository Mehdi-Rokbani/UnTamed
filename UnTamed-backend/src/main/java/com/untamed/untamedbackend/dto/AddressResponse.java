// src/main/java/com/untamed/untamedbackend/dto/AddressResponse.java
package com.untamed.untamedbackend.dto;

import java.time.Instant;

public record AddressResponse(
        String id,
        String provider,
        String providerPlaceId,
        String displayName,
        String governorate,
        String delegation,
        String locality,
        Double latitude,
        Double longitude,
        long usesCount,
        Instant createdAt,
        Instant updatedAt
) {}

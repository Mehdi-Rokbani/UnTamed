// src/main/java/com/untamed/untamedbackend/dto/AddressPickDto.java
package com.untamed.untamedbackend.dto;

import jakarta.validation.constraints.*;

public record AddressPickDto(
        @NotBlank String provider,          // "locationiq"
        @NotBlank String providerPlaceId,
        @NotBlank String displayName,

        String governorate,
        String delegation,
        String locality,

        @NotNull @DecimalMin("-90.0")  @DecimalMax("90.0")   Double latitude,
        @NotNull @DecimalMin("-180.0") @DecimalMax("180.0")  Double longitude
) {}

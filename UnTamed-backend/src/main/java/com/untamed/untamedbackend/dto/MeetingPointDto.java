package com.untamed.untamedbackend.dto;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record MeetingPointDto(
        @NotBlank @Size(max = 120) String label,
        @NotBlank @Size(max = 500) String address,
        @NotNull @DecimalMin("-90.0") @DecimalMax("90.0") Double latitude,
        @NotNull @DecimalMin("-180.0") @DecimalMax("180.0") Double longitude,
        @Size(max = 120) String placeId,
        @NotBlank @Pattern(regexp = "LOCATIONIQ") String source
) {}

package com.untamed.untamedbackend.dto;

import jakarta.validation.constraints.Future;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.time.Instant;

public record ActivityCreateRequest(
        @NotBlank String title,
        @NotBlank String description,
        @NotNull @Future Instant date,
        @Min(3) int capacity
) {}

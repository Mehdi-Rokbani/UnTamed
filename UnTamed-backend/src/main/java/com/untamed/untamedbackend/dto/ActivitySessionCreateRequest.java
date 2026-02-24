package com.untamed.untamedbackend.dto;

import jakarta.validation.constraints.Future;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;

import java.time.Instant;

public record ActivitySessionCreateRequest(
        @NotNull @Future Instant date,
        @Min(1) int capacity
) {}
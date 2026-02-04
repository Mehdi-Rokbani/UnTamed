package com.untamed.untamedbackend.dto;

import jakarta.validation.constraints.Future;
import jakarta.validation.constraints.Min;

import java.time.Instant;

public record ActivityUpdateRequest(
        String title,
        String description,
        @Future Instant date,
        Integer capacity
) {}

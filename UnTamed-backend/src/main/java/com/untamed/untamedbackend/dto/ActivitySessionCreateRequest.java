package com.untamed.untamedbackend.dto;

import jakarta.validation.constraints.Future;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.Instant;

public record ActivitySessionCreateRequest(
        @NotNull @Future Instant startAt,
        @NotNull Instant endAt,
        @Min(1) int capacity,
        @Size(max = 300) String meetingPoint,
        @Size(max = 1000) String sessionNote
) {}
package com.untamed.untamedbackend.dto;

import com.untamed.untamedbackend.model.ActivityStatus;
import jakarta.validation.constraints.Future;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Size;

import java.time.Instant;

public record ActivitySessionUpdateRequest(
        @Future Instant startAt,
        Instant endAt,
        @Min(1) Integer capacity,
        ActivityStatus status,
        @Size(max = 300) String meetingPoint,
        @Size(max = 1000) String sessionNote
) {}
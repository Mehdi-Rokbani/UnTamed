package com.untamed.untamedbackend.dto;

import com.untamed.untamedbackend.model.ActivityStatus;
import jakarta.validation.constraints.Future;
import jakarta.validation.constraints.Min;

import java.time.Instant;

public record ActivitySessionUpdateRequest(
        @Future Instant date,
        Integer capacity,
        ActivityStatus status
) {}
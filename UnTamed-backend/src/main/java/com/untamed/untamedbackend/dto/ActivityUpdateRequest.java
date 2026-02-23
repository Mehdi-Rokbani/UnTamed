// src/main/java/com/untamed/untamedbackend/dto/ActivityUpdateRequest.java
package com.untamed.untamedbackend.dto;

import com.untamed.untamedbackend.model.ActivityStatus;
import com.untamed.untamedbackend.model.Difficulty;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Future;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.PositiveOrZero;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

public record ActivityUpdateRequest(
        String title,
        String description,

        Difficulty difficulty,

        @PositiveOrZero BigDecimal price,

        @Future Instant date,

        Integer capacity,

        List<@NotBlank String> categoryIds,

        List<@Valid ActivityImageDto> images,

        List<@NotBlank String> tags,

        ActivityStatus status,

        @Valid AddressPickDto address
) {}

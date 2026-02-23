// src/main/java/com/untamed/untamedbackend/dto/ActivityCreateRequest.java
package com.untamed.untamedbackend.dto;

import com.untamed.untamedbackend.model.Difficulty;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

public record ActivityCreateRequest(
        @NotBlank String title,
        @NotBlank String description,

        @NotNull Difficulty difficulty,

        @PositiveOrZero BigDecimal price,

        @NotNull @Future Instant date,

        @Min(1) Integer capacity,

        @NotEmpty List<@NotBlank String> categoryIds,

         List<@Valid ActivityImageDto> images,

        List<@NotBlank String> tags,

        @NotNull @Valid AddressPickDto address
) {}

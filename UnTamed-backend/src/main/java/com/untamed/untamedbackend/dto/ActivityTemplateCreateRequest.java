package com.untamed.untamedbackend.dto;

import com.untamed.untamedbackend.model.Difficulty;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;

import java.math.BigDecimal;
import java.util.List;

public record ActivityTemplateCreateRequest(
        @NotBlank String title,
        @NotBlank String description,
        @NotNull Difficulty difficulty,
        @PositiveOrZero BigDecimal price,

        @NotEmpty List<@NotBlank String> categoryIds,

        List<@Valid ActivityImageDto> images,
        List<@NotBlank String> tags,
        List<@NotBlank String> safetyNotes,

        @NotNull @Valid AddressPickDto address
) {}
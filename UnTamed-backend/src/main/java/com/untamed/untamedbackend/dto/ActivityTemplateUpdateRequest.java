package com.untamed.untamedbackend.dto;

import com.untamed.untamedbackend.model.Difficulty;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.PositiveOrZero;

import java.math.BigDecimal;
import java.util.List;

public record ActivityTemplateUpdateRequest(
        String title,
        String description,
        Difficulty difficulty,

        @PositiveOrZero BigDecimal price,

        List<@NotBlank String> categoryIds,
        List<@Valid ActivityImageDto> images,
        List<@NotBlank String> tags,

        @Valid AddressPickDto address
) {}
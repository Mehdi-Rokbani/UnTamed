package com.untamed.untamedbackend.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record SuspensionAppealRequest(
        @NotBlank(message = "Appeal token is required")
        String appealToken,

        @NotBlank(message = "Description is required")
        @Size(min = 10, max = 2000, message = "Description must be between 10 and 2000 characters")
        String description
) {
}

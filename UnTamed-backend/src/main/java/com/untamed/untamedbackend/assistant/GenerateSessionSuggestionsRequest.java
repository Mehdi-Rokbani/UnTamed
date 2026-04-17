package com.untamed.untamedbackend.assistant;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record GenerateSessionSuggestionsRequest(
        @NotBlank
        String templateTitle,

        @NotBlank
        String templateDescription,

        @Size(max = 100)
        String difficulty,

        @Size(max = 200)
        String targetAudience,

        String addressId,

        @Size(max = 200)
        String placeLabel,

        @Size(max = 100)
        String durationPreference,

        @Size(max = 1000)
        String notes
) {}
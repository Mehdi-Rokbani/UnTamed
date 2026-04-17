package com.untamed.untamedbackend.assistant;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record GenerateActivityDraftRequest(
        @NotBlank
        @Size(min = 8, max = 1000)
        String idea,

        @Size(max = 200)
        String targetAudience,

        @Size(max = 200)
        String vibe,

        @Size(max = 1000)
        String notes,

        @Size(max = 100)
        String durationPreference,

        @Size(max = 100)
        String budgetStyle,

        String addressId,

        @Size(max = 200)
        String placeLabel
) {}
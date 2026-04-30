package com.untamed.untamedbackend.assistant;

import com.untamed.untamedbackend.model.Difficulty;

import java.math.BigDecimal;
import java.util.List;

public record GenerateActivityDraftResponse(
        String title,
        String description,
        Difficulty difficulty,

        // Approved tags that can be saved directly on ActivityTemplate
        List<String> tags,

        List<String> semanticHints,

        List<String> suggestedCategoryIds,
        List<String> suggestedCategoryNames,

        BigDecimal suggestedPriceMin,
        BigDecimal suggestedPriceMax,

        Integer suggestedDurationMinutes,
        Integer suggestedCapacity,

        List<String> highlights,
        List<String> includedItems,
        List<String> whatToBring,

        List<String> warnings,
        List<String> missingDetails,

        String meetingPointSuggestion,
        String sessionNoteSuggestion,

        String rationale
) {}
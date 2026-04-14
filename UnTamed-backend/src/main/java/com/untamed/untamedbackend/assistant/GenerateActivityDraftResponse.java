package com.untamed.untamedbackend.assistant;

import com.untamed.untamedbackend.model.Difficulty;

import java.util.List;

public record GenerateActivityDraftResponse(
        String title,
        String description,
        Difficulty difficulty,
        List<String> tags,
        List<String> semanticHints
) {}
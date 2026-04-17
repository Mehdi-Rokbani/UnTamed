package com.untamed.untamedbackend.assistant;

import java.util.List;

public record GenerateSessionSuggestionsResponse(
        Integer suggestedDurationMinutes,
        Integer suggestedCapacity,
        String meetingPointSuggestion,
        String sessionNoteSuggestion,
        List<String> whatToBring,
        List<String> safetyNotes,
        List<String> bestTimeSuggestions,
        List<String> warnings,
        String rationale
) {}
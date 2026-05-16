package com.untamed.untamedbackend.assistant;

import java.util.List;

public record ChatAssistantResponse(
        String answer,
        List<String> suggestedQuestions,
        boolean fallback,
        String model,
        String source,
        List<ChatAssistantRecommendation> recommendations
) {}

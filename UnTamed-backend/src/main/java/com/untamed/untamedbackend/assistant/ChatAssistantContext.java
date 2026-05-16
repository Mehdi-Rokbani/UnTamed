package com.untamed.untamedbackend.assistant;

import java.util.List;

public record ChatAssistantContext(
        String promptContext,
        List<ChatAssistantRecommendation> recommendations
) {
    public ChatAssistantContext {
        recommendations = recommendations != null ? recommendations : List.of();
    }
}

package com.untamed.untamedbackend.assistant;

import java.math.BigDecimal;

public record ChatAssistantRecommendation(
        String id,
        String title,
        String difficulty,
        BigDecimal price,
        String location,
        String imageUrl,
        String reason
) {}

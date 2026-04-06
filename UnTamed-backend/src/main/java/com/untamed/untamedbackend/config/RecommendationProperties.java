package com.untamed.untamedbackend.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;

@Data
@ConfigurationProperties(prefix = "app.recommendation")
public class RecommendationProperties {
    private int candidateLimit = 100;
    private int resultLimit = 12;

    // phase 1: embedding weight stays 0
    private double ruleWeight = 1.0;
    private double embeddingWeight = 0.0;

    private double preferenceWeight = 0.30;
    private double categoryHistoryWeight = 0.25;
    private double difficultyWeight = 0.15;
    private double priceWeight = 0.10;
    private double popularityWeight = 0.10;
    private double freshnessWeight = 0.10;
}
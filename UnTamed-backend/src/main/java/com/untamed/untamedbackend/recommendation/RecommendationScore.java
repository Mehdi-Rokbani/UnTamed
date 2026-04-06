package com.untamed.untamedbackend.recommendation;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class RecommendationScore {
    private double ruleScore;
    private double embeddingScore;
    private double finalScore;
}
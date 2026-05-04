package com.untamed.untamedbackend.recommendation.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class RecommendationItemResponse {
    private String templateId;
    private String title;
    private String description;
    private String coverImageUrl;
    private List<String> categoryIds;
    private String difficulty;
    private BigDecimal price;

    private Double ratingAverage;
    private Integer ratingCount;

    private Instant nextSessionDate;

    private double score;
    private List<String> reasons;

    private Double semanticScore;
    private Double categoryScore;
    private Double difficultyScore;
    private Double budgetScore;
    private Double ratingScore;
    private Double availabilityScore;
    private String recommendationType;
}

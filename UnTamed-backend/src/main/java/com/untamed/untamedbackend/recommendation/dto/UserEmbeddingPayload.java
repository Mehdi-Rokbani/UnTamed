package com.untamed.untamedbackend.recommendation.dto;

import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

@Data
@Builder
public class UserEmbeddingPayload {
    private String userId;
    private List<String> topCategoryIds;
    private List<String> topCategoryNames;
    private Map<String, Integer> categoryScores;
    private Map<String, Integer> difficultyScores;
    private Map<String, Integer> priceRangeScores;
    private BigDecimal avgBookedPrice;
    private BigDecimal minBookedPrice;
    private BigDecimal maxBookedPrice;
    private String level;
    private List<String> preferences;
    private String embeddingProfileHint;
}
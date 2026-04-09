package com.untamed.untamedbackend.recommendation.dto;

import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;
import java.util.List;

@Data
@Builder
public class TemplateEmbeddingPayload {
    private String templateId;
    private String title;
    private String description;
    private String difficulty;
    private BigDecimal price;
    private List<String> tags;
    private List<String> categoryIds;
    private List<String> categoryNames;
    private String embeddingTextHint;
}
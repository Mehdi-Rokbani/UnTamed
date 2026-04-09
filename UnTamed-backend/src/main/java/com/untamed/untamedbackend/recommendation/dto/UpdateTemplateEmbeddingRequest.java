package com.untamed.untamedbackend.recommendation.dto;

import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.util.List;

@Data
public class UpdateTemplateEmbeddingRequest {
    private String embeddingText;

    @NotNull
    @NotEmpty
    private List<Double> embeddingVector;
}
package com.untamed.untamedbackend.recommendation.dto;

import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.util.List;

@Data
public class UpdateUserEmbeddingRequest {
    private String embeddingProfileText;

    @NotNull
    @NotEmpty
    private List<Double> embeddingVector;
}
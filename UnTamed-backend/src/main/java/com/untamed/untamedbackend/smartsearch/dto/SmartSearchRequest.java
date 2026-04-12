package com.untamed.untamedbackend.smartsearch.dto;

import com.untamed.untamedbackend.model.Difficulty;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import lombok.Data;

import java.math.BigDecimal;

@Data
public class SmartSearchRequest {

    @NotBlank(message = "query is required")
    private String query;

    @Min(value = 1, message = "limit must be at least 1")
    @Max(value = 50, message = "limit must be at most 50")
    private Integer limit = 10;

    private String categoryId;

    private Difficulty difficulty;

    private BigDecimal minPrice;

    private BigDecimal maxPrice;
}
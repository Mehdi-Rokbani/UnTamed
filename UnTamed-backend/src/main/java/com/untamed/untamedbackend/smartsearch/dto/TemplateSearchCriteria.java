package com.untamed.untamedbackend.smartsearch.dto;

import lombok.Data;

import java.math.BigDecimal;
import java.time.Instant;

@Data
public class TemplateSearchCriteria {
    private String q;
    private String addressId;
    private String categoryId;
    private BigDecimal minPrice;
    private BigDecimal maxPrice;
    private String difficulty;
    private Instant dateFrom;
    private Instant dateTo;
    private String sort;

    // new
    private boolean strictIntentFiltering = true;
}
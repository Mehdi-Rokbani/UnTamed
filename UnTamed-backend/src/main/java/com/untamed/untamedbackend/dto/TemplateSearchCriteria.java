package com.untamed.untamedbackend.dto;

import com.untamed.untamedbackend.model.Difficulty;

import java.time.Instant;

public record TemplateSearchCriteria(
        String q,
        String addressId,
        String categoryId,
        Double minPrice,
        Double maxPrice,
        Difficulty difficulty,
        Instant dateFrom,
        Instant dateTo,
        String sort
) {}
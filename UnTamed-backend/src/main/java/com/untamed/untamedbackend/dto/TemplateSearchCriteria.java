package com.untamed.untamedbackend.dto;

import com.untamed.untamedbackend.model.Difficulty;

import java.time.Instant;
import java.util.List;

public record TemplateSearchCriteria(
        String q,
        String addressId,
        List<String> categoryIds,
        Double minPrice,
        Double maxPrice,
        Difficulty difficulty,
        Instant dateFrom,
        Instant dateTo,
        String sort
) {}
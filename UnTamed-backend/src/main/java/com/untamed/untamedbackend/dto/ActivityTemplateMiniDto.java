package com.untamed.untamedbackend.dto;

import com.untamed.untamedbackend.model.Difficulty;

import java.math.BigDecimal;
import java.util.List;

public record ActivityTemplateMiniDto(
        String id,
        String title,
        BigDecimal price,
        Difficulty difficulty,
        String guideId,
        List<String> tags,
        String coverImageUrl,
        List<String> categoryIds
) {}
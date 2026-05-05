package com.untamed.untamedbackend.dto;

public record ProfileTopCategoryDto(
        String categoryId,
        String categoryName,
        int count
) {}

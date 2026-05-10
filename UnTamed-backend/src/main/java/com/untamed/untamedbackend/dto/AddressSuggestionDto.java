package com.untamed.untamedbackend.dto;

public record AddressSuggestionDto(
        String id,
        String displayName,
        String governorate,
        String delegation,
        String locality,
        Double latitude,
        Double longitude,
        Long usesCount
) {}

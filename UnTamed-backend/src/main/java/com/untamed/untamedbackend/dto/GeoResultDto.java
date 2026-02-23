package com.untamed.untamedbackend.dto;

public record GeoResultDto(
        String providerPlaceId,
        String displayName,
        double latitude,
        double longitude
) {}

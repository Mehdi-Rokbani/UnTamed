package com.untamed.untamedbackend.dto;

import java.time.Instant;

public record ActivityResponse(
        String id,
        String title,
        String description,
        Instant date,
        int capacity,
        boolean published,
        String guideId
) {}

package com.untamed.untamedbackend.dto;

import java.time.Instant;

public record PublicSessionDto(
        String id,
        Instant date,
        int capacity,
        int bookedCount
) {}
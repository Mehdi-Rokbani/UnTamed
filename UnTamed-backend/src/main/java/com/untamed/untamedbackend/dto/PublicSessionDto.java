package com.untamed.untamedbackend.dto;

import java.time.Instant;

public record PublicSessionDto(
        String id,
        Instant startAt,
        Instant endAt,
        int capacity,
        int bookedCount
) {}
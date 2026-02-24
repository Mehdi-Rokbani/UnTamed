package com.untamed.untamedbackend.dto;

import java.time.Instant;

public record PublicNextSessionDto(
        String sessionId,
        Instant date,
        int capacity,
        int bookedCount
) {}
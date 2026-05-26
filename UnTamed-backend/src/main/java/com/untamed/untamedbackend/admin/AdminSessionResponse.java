package com.untamed.untamedbackend.admin;

import java.time.Instant;

public record AdminSessionResponse(
        String id,
        String activityTitle,
        String guideName,
        Instant startDateTime,
        int capacity,
        int bookedCount,
        String status
) {}

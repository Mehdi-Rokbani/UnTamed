package com.untamed.untamedbackend.admin;

import java.time.Instant;

public record AdminActivityResponse(
        String id,
        String title,
        String category,
        String location,
        String guideId,
        String guideName,
        String guideEmail,
        String coverImageUrl,
        String status,
        long sessionsCount,
        long publishedSessionsCount,
        Instant createdAt
) {}

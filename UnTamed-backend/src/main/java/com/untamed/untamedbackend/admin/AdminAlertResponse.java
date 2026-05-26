package com.untamed.untamedbackend.admin;

import java.time.Instant;

public record AdminAlertResponse(
        String id,
        String type,
        String severity,
        String title,
        String description,
        String entityType,
        String entityId,
        String route,
        String status,
        Instant createdAt
) {}

package com.untamed.untamedbackend.admin;

import java.time.Instant;

public record AdminAuditLogResponse(
        String id,
        String adminId,
        String adminEmail,
        String action,
        String targetType,
        String targetId,
        String targetLabel,
        String reason,
        String details,
        Instant createdAt
) {}

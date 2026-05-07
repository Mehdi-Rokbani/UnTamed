package com.untamed.untamedbackend.notification;

import java.time.Instant;

public record NotificationResponse(
        String id,
        NotificationType type,
        String title,
        String message,
        NotificationSeverity severity,
        boolean read,
        Instant readAt,
        String actionUrl,
        String relatedEntityType,
        String relatedEntityId,
        Instant createdAt
) {
}

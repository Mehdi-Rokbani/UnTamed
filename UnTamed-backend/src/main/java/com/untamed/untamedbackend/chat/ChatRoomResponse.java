package com.untamed.untamedbackend.chat;

import java.time.Instant;

public record ChatRoomResponse(
        String id,
        String sessionId,
        String templateId,
        String guideId,
        String activityTitle,
        String activityImageUrl,
        int participantCount,
        String lastMessagePreview,
        Instant lastMessageAt,
        Instant createdAt,
        Instant updatedAt
) {
}

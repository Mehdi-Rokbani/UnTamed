package com.untamed.untamedbackend.chat;

import java.time.Instant;

public record ChatMessageResponse(
        String id,
        String roomId,
        String sessionId,
        String senderId,
        String senderUsername,
        String senderProfileImageUrl,
        String senderRole,
        ChatMessageType type,
        String message,
        boolean mine,
        Instant createdAt
) {
}

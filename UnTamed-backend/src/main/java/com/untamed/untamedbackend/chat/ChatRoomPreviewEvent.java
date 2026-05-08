package com.untamed.untamedbackend.chat;

import java.time.Instant;

public record ChatRoomPreviewEvent(
        String roomId,
        String sessionId,
        String lastMessageId,
        String lastMessageText,
        String lastMessageSenderId,
        String lastMessageSenderName,
        Instant lastMessageAt,
        Integer participantCount,
        String type
) {
}

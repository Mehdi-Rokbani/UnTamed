package com.untamed.untamedbackend.chat;

import java.time.Instant;

public record ChatRoomMembershipEvent(
        String roomId,
        String sessionId,
        String userId,
        String type,
        String message,
        Instant createdAt
) {
}

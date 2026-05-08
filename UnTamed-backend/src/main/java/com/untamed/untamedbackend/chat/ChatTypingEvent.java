package com.untamed.untamedbackend.chat;

import java.time.Instant;

public record ChatTypingEvent(
        String roomId,
        String userId,
        String username,
        boolean typing,
        Instant createdAt
) {
}

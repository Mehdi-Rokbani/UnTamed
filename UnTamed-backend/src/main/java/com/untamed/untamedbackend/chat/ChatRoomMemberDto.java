package com.untamed.untamedbackend.chat;

import java.time.Instant;

public record ChatRoomMemberDto(
        String userId,
        String name,
        String email,
        String role,
        String avatarUrl,
        boolean owner,
        Instant joinedAt
) {
}

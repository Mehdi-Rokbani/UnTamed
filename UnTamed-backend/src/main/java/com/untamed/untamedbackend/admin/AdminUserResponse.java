package com.untamed.untamedbackend.admin;

import java.time.Instant;

public record AdminUserResponse(
        String id,
        String username,
        String email,
        String role,
        boolean verified,
        boolean enabled,
        boolean suspended,
        String profileImageUrl,
        Instant createdAt,
        String status
) {}

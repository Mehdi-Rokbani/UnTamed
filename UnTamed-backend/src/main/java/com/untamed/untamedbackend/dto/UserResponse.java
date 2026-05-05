package com.untamed.untamedbackend.dto;

import com.untamed.untamedbackend.model.Level;

import java.time.Instant;
import java.util.List;

public record UserResponse(
        String id,
        String email,
        String role,
        String username,
        Level level,
        String profileImageUrl,
        String phoneNumber,
        List<String> preferences,
        int confirmedTripsCount,
        int reviewsWrittenCount,
        String bio,
        Boolean verified,
        Boolean enabled,
        Instant createdAt,
        UserGuideProfileResponse guideProfile
) {}

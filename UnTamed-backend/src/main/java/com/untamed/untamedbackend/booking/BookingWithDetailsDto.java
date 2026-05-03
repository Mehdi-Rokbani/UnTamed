package com.untamed.untamedbackend.booking;

import java.math.BigDecimal;
import java.time.Instant;

public record BookingWithDetailsDto(
        String id,
        String userId,
        String sessionId,
        int numberOfPeople,
        BookingStatus status,
        Instant createdAt,
        Instant updatedAt,
        Instant expiresAt,

        // Template
        String activityTitle,
        String activityImageUrl,

        // Session
        Instant sessionStartAt,

        // Address
        String displayName,
        String governorate,
        String locality,
        Double latitude,
        Double longitude,

        // Price
        BigDecimal pricePerPerson,
        BigDecimal totalPrice
) {}
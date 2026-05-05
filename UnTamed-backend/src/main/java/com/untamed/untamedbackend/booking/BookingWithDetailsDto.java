package com.untamed.untamedbackend.booking;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

public record BookingWithDetailsDto(
        String id,
        String userId,
        String sessionId,
        int numberOfPeople,
        List<String> guestNames,
        BookingStatus status,
        Instant createdAt,
        Instant updatedAt,
        Instant expiresAt,

        // Template
        String activityTemplateId,
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
        BigDecimal totalPrice,

        // Review eligibility
        boolean reviewEligible,
        boolean alreadyReviewed,
        String reviewId,
        String reviewReason
) {}

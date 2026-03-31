package com.untamed.untamedbackend.dto;

import com.untamed.untamedbackend.booking.BookingStatus;

import java.time.Instant;

public record GuideParticipantDto(
        String bookingId,
        String userId,
        String username,
        String email,
        String profileImageUrl,
        int numberOfPeople,
        BookingStatus status,
        Instant createdAt
) {}
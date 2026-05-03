package com.untamed.untamedbackend.dto;

import com.untamed.untamedbackend.booking.BookingStatus;

import java.time.Instant;
import java.util.List;

public record GuideParticipantDto(
        String bookingId,
        String userId,
        String username,
        String email,
        String profileImageUrl,
        int numberOfPeople,
        BookingStatus status,
        Instant createdAt,
        List<GuidePassAttendanceDto> passes
) {}

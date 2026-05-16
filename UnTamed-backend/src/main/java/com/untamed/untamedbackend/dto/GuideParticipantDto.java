package com.untamed.untamedbackend.dto;

import com.untamed.untamedbackend.booking.BookingStatus;
import com.untamed.untamedbackend.booking.CancelledBy;
import com.untamed.untamedbackend.booking.RefundStatus;

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
        int totalAmount,
        String currency,
        RefundStatus refundStatus,
        int refundPercent,
        int refundAmount,
        String refundCurrency,
        CancelledBy cancelledBy,
        String cancellationReason,
        Instant cancelledAt,
        List<GuidePassAttendanceDto> passes
) {}

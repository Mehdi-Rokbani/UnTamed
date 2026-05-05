package com.untamed.untamedbackend.dto;

import com.untamed.untamedbackend.booking.BookingStatus;

import java.time.Instant;
import java.util.List;

public record ProfileCompletedTripDto(
        String bookingId,
        String sessionId,
        String templateId,
        String activityTitle,
        String activityImageUrl,
        String addressDisplayName,
        String governorate,
        List<String> categoryIds,
        List<String> categoryNames,
        Instant sessionStartAt,
        Instant sessionEndAt,
        int numberOfPeople,
        BookingStatus bookingStatus,
        ProfileTripAttendanceSummaryDto attendanceSummary,
        boolean reviewEligible,
        boolean alreadyReviewed,
        String reviewId
) {}

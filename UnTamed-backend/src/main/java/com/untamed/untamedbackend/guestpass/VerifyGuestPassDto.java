package com.untamed.untamedbackend.guestpass;

import java.time.Instant;

public record VerifyGuestPassDto(
        boolean valid,
        String message,

        String guestPassId,
        String bookingId,
        String sessionId,
        String activityTemplateId,
        String guideId,

        int passNumber,
        int totalPasses,

        String guestName,
        boolean mainBooker,

        GuestPassStatus passStatus,
        AttendanceStatus attendanceStatus,

        String activityTitle,
        Instant sessionStartAt,
        int numberOfPeople,

        boolean present,
        boolean absent,
        Instant markedAt,
        String markedByGuideId
) {
}
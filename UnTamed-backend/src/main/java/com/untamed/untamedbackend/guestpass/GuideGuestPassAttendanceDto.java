package com.untamed.untamedbackend.guestpass;

import java.time.Instant;

public record GuideGuestPassAttendanceDto(
        String id,

        String bookingId,
        String sessionId,
        String activityTemplateId,
        String guideId,

        String guestName,
        boolean mainBooker,

        int passNumber,
        int totalPasses,

        GuestPassStatus status,
        AttendanceStatus attendanceStatus,

        String activityTitle,
        Instant sessionStartAt,

        Instant createdAt,
        Instant markedAt,
        String markedByGuideId
) {
}
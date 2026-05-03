package com.untamed.untamedbackend.guestpass;

import java.time.Instant;

public record GuestPassDto(
        String id,
        String bookingId,
        String sessionId,
        String activityTemplateId,
        String guideId,
        String token,

        int passNumber,
        int totalPasses,

        String guestName,
        boolean mainBooker,

        GuestPassStatus status,
        AttendanceStatus attendanceStatus,

        Instant createdAt,
        Instant markedAt,
        String markedByGuideId
) {
    public static GuestPassDto from(GuestPass pass) {
        return new GuestPassDto(
                pass.getId(),
                pass.getBookingId(),
                pass.getSessionId(),
                pass.getActivityTemplateId(),
                pass.getGuideId(),
                pass.getToken(),
                pass.getPassNumber(),
                pass.getTotalPasses(),
                pass.getGuestName(),
                pass.isMainBooker(),
                pass.getStatus(),
                pass.getAttendanceStatus(),
                pass.getCreatedAt(),
                pass.getMarkedAt(),
                pass.getMarkedByGuideId()
        );
    }
}
package com.untamed.untamedbackend.dto;

import com.untamed.untamedbackend.guestpass.AttendanceStatus;
import com.untamed.untamedbackend.guestpass.GuestPassStatus;

import java.time.Instant;

public record GuidePassAttendanceDto(
        String passId,
        String bookingId,
        String guestName,
        int passNumber,
        int totalPasses,
        boolean mainBooker,
        GuestPassStatus status,
        AttendanceStatus attendanceStatus,
        Instant markedAt,
        String markedByGuideId
) {}

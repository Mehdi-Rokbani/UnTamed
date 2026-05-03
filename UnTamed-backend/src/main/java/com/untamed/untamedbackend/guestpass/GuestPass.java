package com.untamed.untamedbackend.guestpass;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;

@Document(collection = "guest_passes")
public class GuestPass {

    @Id
    private String id;

    private String bookingId;
    private String sessionId;
    private String activityTemplateId;
    private String guideId;

    private String token;

    private int passNumber;
    private int totalPasses;

    private String guestName;
    private boolean mainBooker;

    private GuestPassStatus status;
    private AttendanceStatus attendanceStatus;

    private Instant createdAt;
    private Instant markedAt;
    private String markedByGuideId;

    public GuestPass() {
    }

    public GuestPass(
            String bookingId,
            String sessionId,
            String activityTemplateId,
            String guideId,
            String token,
            int passNumber,
            int totalPasses,
            String guestName,
            boolean mainBooker
    ) {
        this.bookingId = bookingId;
        this.sessionId = sessionId;
        this.activityTemplateId = activityTemplateId;
        this.guideId = guideId;
        this.token = token;
        this.passNumber = passNumber;
        this.totalPasses = totalPasses;
        this.guestName = guestName;
        this.mainBooker = mainBooker;
        this.status = GuestPassStatus.ACTIVE;
        this.attendanceStatus = AttendanceStatus.NOT_MARKED;
        this.createdAt = Instant.now();
    }

    public String getId() {
        return id;
    }

    public String getBookingId() {
        return bookingId;
    }

    public String getSessionId() {
        return sessionId;
    }

    public String getActivityTemplateId() {
        return activityTemplateId;
    }

    public String getGuideId() {
        return guideId;
    }

    public String getToken() {
        return token;
    }

    public int getPassNumber() {
        return passNumber;
    }

    public int getTotalPasses() {
        return totalPasses;
    }

    public String getGuestName() {
        return guestName;
    }

    public boolean isMainBooker() {
        return mainBooker;
    }

    public GuestPassStatus getStatus() {
        return status;
    }

    public AttendanceStatus getAttendanceStatus() {
        return attendanceStatus;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public Instant getMarkedAt() {
        return markedAt;
    }

    public String getMarkedByGuideId() {
        return markedByGuideId;
    }

    public boolean isPresent() {
        return attendanceStatus == AttendanceStatus.PRESENT;
    }

    public boolean isAbsent() {
        return attendanceStatus == AttendanceStatus.ABSENT;
    }

    public void markPresent(String guideId) {
        this.attendanceStatus = AttendanceStatus.PRESENT;
        this.markedAt = Instant.now();
        this.markedByGuideId = guideId;
    }

    public void markAbsent(String guideId) {
        this.attendanceStatus = AttendanceStatus.ABSENT;
        this.markedAt = Instant.now();
        this.markedByGuideId = guideId;
    }

    public void resetAttendance() {
        this.attendanceStatus = AttendanceStatus.NOT_MARKED;
        this.markedAt = null;
        this.markedByGuideId = null;
    }

    public void cancel() {
        this.status = GuestPassStatus.CANCELLED;
    }
}
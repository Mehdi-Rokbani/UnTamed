package com.untamed.untamedbackend.admin;

public record AdminCancelSessionResponse(
        String sessionId,
        String sessionStatus,
        int affectedBookings,
        int pendingCancelled,
        int payingNeedsReview,
        int paidNeedsRefund,
        int usersNotified,
        int notificationsFailed,
        String message
) {}

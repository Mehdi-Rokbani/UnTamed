package com.untamed.untamedbackend.admin;

import java.time.Instant;

public record AdminRefundItemResponse(
        String bookingId,
        String userName,
        String userEmail,
        String activityTitle,
        Instant sessionDate,
        double amount,
        int refundPercent,
        double refundAmount,
        String refundStatus,
        String paymentIntentId,
        String cancelReason,
        Instant cancelledAt,
        boolean userNotified,
        String message
) {}

package com.untamed.untamedbackend.revenue;

import java.math.BigDecimal;
import java.time.Instant;

public record RevenueRecordResponse(
        String id,
        String bookingId,
        String paymentAttemptId,
        String sessionId,
        String templateId,
        String activityTitle,
        String guideId,
        String guideName,
        String guideEmail,
        String userId,
        int grossAmountMinor,
        int platformCommissionMinor,
        int guidePayoutMinor,
        String currency,
        BigDecimal commissionRate,
        String status,
        Instant bookingDate,
        Instant sessionStartAt,
        Instant createdAt,
        Instant updatedAt,
        Instant sessionCompletedAt,
        String payoutBatchId,
        Instant paidAt
) {}

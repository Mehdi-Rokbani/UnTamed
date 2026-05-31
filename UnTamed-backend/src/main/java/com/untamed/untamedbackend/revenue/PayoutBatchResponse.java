package com.untamed.untamedbackend.revenue;

import java.time.Instant;

public record PayoutBatchResponse(
        String id,
        String guideId,
        String guideName,
        String guideEmail,
        Instant periodStart,
        Instant periodEnd,
        int totalGrossMinor,
        int totalCommissionMinor,
        int totalPayoutMinor,
        String currency,
        int totalBookings,
        String status,
        Instant createdAt,
        Instant updatedAt,
        Instant paidAt
) {}

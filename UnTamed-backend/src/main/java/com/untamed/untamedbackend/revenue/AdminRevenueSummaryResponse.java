package com.untamed.untamedbackend.revenue;

public record AdminRevenueSummaryResponse(
        int totalGrossMinor,
        int totalPlatformCommissionMinor,
        int totalGuidePayoutMinor,
        int readyPayoutMinor,
        int scheduledPayoutMinor,
        int paidPayoutMinor,
        long totalRevenueRecords,
        long readyRecords,
        long scheduledRecords,
        long paidRecords,
        long payoutBatches
) {}

package com.untamed.untamedbackend.revenue;

public record GuideEarningsSummaryResponse(
        int grossCompletedBookingAmountMinor,
        int platformCommissionMinor,
        int guideEarningsMinor,
        int pendingPayoutMinor,
        int scheduledPayoutMinor,
        int paidPayoutMinor,
        long revenueRecords,
        long payoutBatches
) {}

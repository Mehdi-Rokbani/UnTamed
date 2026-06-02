package com.untamed.untamedbackend.revenue;

import java.util.List;

public record RunWeeklyPayoutsResponse(
        int createdBatches,
        int scheduledRecords,
        List<PayoutBatchResponse> batches
) {
}

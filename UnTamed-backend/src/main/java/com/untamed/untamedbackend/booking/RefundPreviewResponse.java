package com.untamed.untamedbackend.booking;

import lombok.Builder;

@Builder
public record RefundPreviewResponse(
        boolean refundable,
        int refundPercent,
        int refundAmount,
        String currency,
        RefundStatus refundStatus,
        String reason
) {}
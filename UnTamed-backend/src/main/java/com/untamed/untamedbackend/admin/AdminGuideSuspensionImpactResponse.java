package com.untamed.untamedbackend.admin;

import java.time.Instant;
import java.util.List;

public record AdminGuideSuspensionImpactResponse(
        String guideId,
        String guideName,
        String guideEmail,
        int upcomingSessionsCount,
        int confirmedBookingsCount,
        int pendingBookingsCount,
        int payingBookingsCount,
        double estimatedPaidAmount,
        List<SessionImpact> sessions
) {
    public record SessionImpact(
            String sessionId,
            String activityTitle,
            Instant startDateTime,
            String status,
            int confirmedBookingsCount,
            int pendingBookingsCount,
            int payingBookingsCount,
            double paidAmount
    ) {}
}

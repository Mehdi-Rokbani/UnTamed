package com.untamed.untamedbackend.revenue;

import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class WeeklyPayoutJob {

    private static final Logger log = LoggerFactory.getLogger(WeeklyPayoutJob.class);

    private final RevenueService revenueService;

    @Value("${app.jobs.weekly-payouts.enabled:true}")
    private boolean enabled;

    @Scheduled(
            cron = "${app.jobs.weekly-payouts.cron:0 0 2 * * MON}",
            zone = "${app.jobs.weekly-payouts.zone:UTC}"
    )
    public void createWeeklyPayoutBatches() {
        if (!enabled) {
            return;
        }

        try {
            revenueService.createWeeklyPayoutBatches();
        } catch (RuntimeException e) {
            log.warn("Skipping weekly payout batching run because processing failed.", e);
        }
    }
}

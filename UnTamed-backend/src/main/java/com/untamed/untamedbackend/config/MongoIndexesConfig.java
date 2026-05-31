package com.untamed.untamedbackend.config;

import com.untamed.untamedbackend.booking.Booking;
import com.untamed.untamedbackend.booking.BookingStatus;
import com.untamed.untamedbackend.revenue.RevenueRecord;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.domain.Sort.Direction;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.index.Index;
import org.springframework.data.mongodb.core.index.PartialIndexFilter;
import org.springframework.data.mongodb.core.query.Criteria;

import java.util.List;

/**
 * Ensures MongoDB indexes are present at startup.

 * Goal:
 * - A user can have at most ONE unpaid-active booking per (userId, sessionId) at a time.
 *   unpaid-active = PENDING or PAYING
 * - Completed/Expired/Cancelled bookings are allowed historically (multiple over time).
 */
@Configuration
public class MongoIndexesConfig {

    private static final Logger log = LoggerFactory.getLogger(MongoIndexesConfig.class);

    @Bean
    ApplicationRunner ensureBookingIndexes(
            MongoTemplate mongoTemplate,
            @Value("${app.mongo.ensure-indexes.enabled:true}") boolean ensureIndexesEnabled,
            @Value("${app.mongo.ensure-indexes.fail-fast:true}") boolean ensureIndexesFailFast,
            @Value("${app.mongo.ensure-indexes.max-attempts:3}") int maxAttempts,
            @Value("${app.mongo.ensure-indexes.retry-delay-ms:5000}") long retryDelayMs
    ) {
        return args -> {
            if (!ensureIndexesEnabled) {
                log.info("Mongo index creation is disabled by app.mongo.ensure-indexes.enabled=false.");
                return;
            }

            log.info("Starting Mongo index creation for booking and revenue constraints.");

            Index uniqUnpaidActiveBooking = new Index()
                    .on("userId", Direction.ASC)
                    .on("sessionId", Direction.ASC)
                    .named("uniq_unpaid_active_booking_user_session")
                    .unique()
                    .partial(PartialIndexFilter.of(
                            Criteria.where("status").in(List.of(
                                    BookingStatus.PENDING,
                                    BookingStatus.PAYING
                            ))
                    ));

            Index uniqRevenueBooking = new Index()
                    .on("bookingId", Direction.ASC)
                    .named("uniq_revenue_record_booking")
                    .unique();

            RuntimeException lastFailure = null;
            int safeMaxAttempts = Math.max(1, maxAttempts);

            for (int attempt = 1; attempt <= safeMaxAttempts; attempt++) {
                try {
                    mongoTemplate.indexOps(Booking.class).ensureIndex(uniqUnpaidActiveBooking);
                    mongoTemplate.indexOps(RevenueRecord.class).ensureIndex(uniqRevenueBooking);
                    log.info(
                            "Mongo index creation completed on attempt {}/{}. Ensured indexes: uniq_unpaid_active_booking_user_session, uniq_revenue_record_booking.",
                            attempt,
                            safeMaxAttempts
                    );
                    return;
                } catch (RuntimeException e) {
                    lastFailure = e;
                    log.warn(
                            "Mongo index creation attempt {}/{} failed. Atlas/network access may be unavailable or the primary may still be connecting.",
                            attempt,
                            safeMaxAttempts,
                            e
                    );
                    if (attempt < safeMaxAttempts) {
                        sleepBeforeRetry(retryDelayMs);
                    }
                }
            }

            log.error(
                    "Mongo index creation failed for bookings after {} attempt(s). fail-fast={}",
                    safeMaxAttempts,
                    ensureIndexesFailFast,
                    lastFailure
            );
            if (ensureIndexesFailFast && lastFailure != null) {
                throw lastFailure;
            }
        };
    }

    private void sleepBeforeRetry(long retryDelayMs) {
        try {
            Thread.sleep(Math.max(0, retryDelayMs));
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException("Interrupted while retrying Mongo index creation", e);
        }
    }
}

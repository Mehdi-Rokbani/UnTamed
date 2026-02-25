package com.untamed.untamedbackend.config;

import com.untamed.untamedbackend.booking.Booking;
import com.untamed.untamedbackend.booking.BookingStatus;
import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.domain.Sort.Direction;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.index.Index;
import org.springframework.data.mongodb.core.index.PartialIndexFilter;
import org.springframework.data.mongodb.core.query.Criteria;

/**
 * Ensures MongoDB indexes are present at startup.
 *
 * Goal:
 * - A user can have at most ONE *PENDING* booking per (userId, sessionId) at a time.
 * - Completed/Expired/Cancelled bookings are allowed historically (multiple over time).
 */
@Configuration
public class MongoIndexesConfig {

    @Bean
    ApplicationRunner ensureBookingIndexes(MongoTemplate mongoTemplate) {
        return args -> {
            Index uniqPendingBookingPerUserSession = new Index()
                    .on("userId", Direction.ASC)
                    .on("sessionId", Direction.ASC)
                    .named("uniq_pending_booking_user_session")
                    .unique()
                    .partial(PartialIndexFilter.of(
                            Criteria.where("status").is(BookingStatus.PENDING)
                    ));

            mongoTemplate.indexOps(Booking.class).ensureIndex(uniqPendingBookingPerUserSession);
        };
    }
}
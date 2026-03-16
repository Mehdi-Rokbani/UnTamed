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

    @Bean
    ApplicationRunner ensureBookingIndexes(MongoTemplate mongoTemplate) {
        return args -> {

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

            mongoTemplate.indexOps(Booking.class).ensureIndex(uniqUnpaidActiveBooking);
        };
    }
}
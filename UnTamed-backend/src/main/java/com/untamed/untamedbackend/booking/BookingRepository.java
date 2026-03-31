package com.untamed.untamedbackend.booking;

import org.springframework.data.mongodb.repository.MongoRepository;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

public interface BookingRepository extends MongoRepository<Booking, String> {

    /**
     * v1 rule:
     * - At most one PENDING booking per user+session.
     * - COMPLETED bookings are immutable and do not get "reused" when creating a new booking.
     */
    Optional<Booking> findFirstByUserIdAndSessionIdAndStatus(
            String userId,
            String sessionId,
            BookingStatus status
    );

    // kept (optional) for other uses / backwards compatibility
    Optional<Booking> findFirstByUserIdAndSessionIdAndStatusIn(
            String userId,
            String sessionId,
            List<BookingStatus> statuses
    );

    List<Booking> findByStatusAndExpiresAtBefore(BookingStatus status, Instant now);
    List<Booking> findByUserIdOrderByCreatedAtDesc(String userId);
    List<Booking> findBySessionIdAndStatusOrderByCreatedAtAsc(String sessionId, BookingStatus status);

    List<Booking> findBySessionIdOrderByCreatedAtAsc(String sessionId);


}
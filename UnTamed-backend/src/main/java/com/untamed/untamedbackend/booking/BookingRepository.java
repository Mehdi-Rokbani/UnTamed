package com.untamed.untamedbackend.booking;

import org.springframework.data.mongodb.repository.MongoRepository;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

public interface BookingRepository extends MongoRepository<Booking, String> {

    Optional<Booking> findFirstByUserIdAndSessionIdAndStatusIn(
            String userId,
            String sessionId,
            List<BookingStatus> statuses
    );

    List<Booking> findByStatusAndExpiresAtBefore(BookingStatus status, Instant now);
    List<Booking> findByUserIdOrderByCreatedAtDesc(String userId);
}
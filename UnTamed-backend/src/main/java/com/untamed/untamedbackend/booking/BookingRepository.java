package com.untamed.untamedbackend.booking;

import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import java.time.Instant;
import java.util.Collection;
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
    Page<Booking> findByUserId(String userId, Pageable pageable);
    List<Booking> findBySessionIdAndStatusOrderByCreatedAtAsc(String sessionId, BookingStatus status);

    List<Booking> findBySessionIdOrderByCreatedAtAsc(String sessionId);
    Optional<Booking> findByIdAndUserId(String id, String userId);
    List<Booking> findByUserIdAndStatusOrderByCreatedAtDesc(String userId, BookingStatus status);

    Page<Booking> findByUserIdAndStatus(String userId, BookingStatus status, Pageable pageable);

    List<Booking> findBySessionIdAndStatus(String sessionId, BookingStatus status);
    List<Booking> findByUserId(String userId);
    List<Booking> findBySessionIdInAndStatusIn(Collection<String> sessionIds, Collection<BookingStatus> statuses);
    boolean existsBySessionIdAndStatusIn(String sessionId, Collection<BookingStatus> statuses);

    List<Booking> findBySessionIdAndStatusInOrderByCreatedAtAsc(
            String sessionId,
            Collection<BookingStatus> statuses
    );
    List<Booking> findBySessionIdIn(Collection<String> sessionIds);

    void deleteBySessionIdIn(Collection<String> sessionIds);

    List<Booking> findByUserIdAndStatus(String userId, BookingStatus status);

    boolean existsBySessionIdAndUserIdAndStatus(String sessionId, String userId, BookingStatus status);
}

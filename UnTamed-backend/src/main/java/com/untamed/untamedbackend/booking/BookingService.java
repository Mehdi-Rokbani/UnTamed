package com.untamed.untamedbackend.booking;

import com.untamed.untamedbackend.model.ActivitySession;
import com.untamed.untamedbackend.model.ActivityStatus;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.time.Duration;
import java.time.Instant;
import java.util.List;

@Service
@RequiredArgsConstructor
public class BookingService {

    private static final Duration CUTOFF = Duration.ofHours(5);

    private final BookingRepository bookingRepository;
    private final SessionSeatOps sessionSeatOps;

    public String requireUserId(Authentication auth) {
        if (auth == null || !auth.isAuthenticated()) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, BookingErrors.NOT_AUTHENTICATED);
        }
        return auth.getName(); // your system currently uses email as name (fine)
    }

    /** Option 1: one active booking per user+session.
     * If an active booking exists (PENDING/COMPLETED), we increase seats instead of creating a new booking.
     */
    public Booking createOrIncreaseBooking(String userId, String sessionId, int people) {
        if (people < 1) throw bad(BookingErrors.INVALID_PEOPLE);

        // validate session and cutoff + guide restriction
        ActivitySession session = sessionSeatOps.getSessionOrThrow(sessionId);
        validateSessionBookable(session, userId);

        // if active booking exists -> increase seats
        var existingOpt = bookingRepository.findFirstByUserIdAndSessionIdAndStatusIn(
                userId,
                sessionId,
                List.of(BookingStatus.PENDING, BookingStatus.COMPLETED)
        );

        if (existingOpt.isPresent()) {
            return increaseSeats(existingOpt.get().getId(), userId, people);
        }

        // reserve seats atomically
        boolean reserved = sessionSeatOps.tryReserveSeats(sessionId, people);
        if (!reserved) throw conflict(BookingErrors.SOLD_OUT);

        Instant now = Instant.now();
        Booking booking = Booking.builder()
                .userId(userId)
                .sessionId(sessionId)
                .numberOfPeople(people)
                .status(BookingStatus.PENDING)
                .createdAt(now)
                .updatedAt(now)
                .expiresAt(computeExpiresAt(session.getDate(), now))
                .build();

        return bookingRepository.save(booking);
    }

    public Booking increaseSeats(String bookingId, String userId, int delta) {
        if (delta < 1) throw bad(BookingErrors.INVALID_DELTA);

        Booking b = bookingRepository.findById(bookingId)
                .orElseThrow(() -> notFound(BookingErrors.BOOKING_NOT_FOUND));

        assertOwned(b, userId);
        assertActive(b);

        ActivitySession session = sessionSeatOps.getSessionOrThrow(b.getSessionId());
        validateSessionBookable(session, userId);

        boolean reserved = sessionSeatOps.tryReserveSeats(b.getSessionId(), delta);
        if (!reserved) throw conflict(BookingErrors.SOLD_OUT);

        b.setNumberOfPeople(b.getNumberOfPeople() + delta);
        b.setUpdatedAt(Instant.now());

        // If still pending, keep/extend expiry window
        if (b.getStatus() == BookingStatus.PENDING) {
            b.setExpiresAt(computeExpiresAt(session.getDate(), Instant.now()));
        } else {
            // COMPLETED bookings do not expire
            b.setExpiresAt(null);
        }

        return bookingRepository.save(b);
    }

    public Booking decreaseSeats(String bookingId, String userId, int delta) {
        if (delta < 1) throw bad(BookingErrors.INVALID_DELTA);

        Booking b = bookingRepository.findById(bookingId)
                .orElseThrow(() -> notFound(BookingErrors.BOOKING_NOT_FOUND));

        assertOwned(b, userId);
        assertActive(b);

        ActivitySession session = sessionSeatOps.getSessionOrThrow(b.getSessionId());
        validateSessionChangeAllowed(session);

        int current = b.getNumberOfPeople();
        if (delta >= current) {
            // decreasing to 0 -> cancel
            cancelBooking(bookingId, userId);
            // reload the booking
            return bookingRepository.findById(bookingId)
                    .orElseThrow(() -> notFound(BookingErrors.BOOKING_NOT_FOUND));
        }

        // release seats
        sessionSeatOps.releaseSeats(b.getSessionId(), delta);

        b.setNumberOfPeople(current - delta);
        b.setUpdatedAt(Instant.now());

        // if completed, mark refund metadata (actual refund will be wired later)
        if (b.getStatus() == BookingStatus.COMPLETED) {
            b.setRefundRequested(true);
            b.setRefundSeatsRequested(b.getRefundSeatsRequested() + delta);
        }

        return bookingRepository.save(b);
    }

    public CancelBookingResponse cancelBooking(String bookingId, String userId) {
        Booking b = bookingRepository.findById(bookingId)
                .orElseThrow(() -> notFound(BookingErrors.BOOKING_NOT_FOUND));

        assertOwned(b, userId);
        assertActive(b);

        ActivitySession session = sessionSeatOps.getSessionOrThrow(b.getSessionId());
        validateSessionChangeAllowed(session);

        int toRelease = b.getNumberOfPeople();
        if (toRelease > 0) {
            sessionSeatOps.releaseSeats(b.getSessionId(), toRelease);
        }

        b.setNumberOfPeople(0);
        b.setStatus(BookingStatus.CANCELLED);
        b.setUpdatedAt(Instant.now());
        b.setExpiresAt(null);

        if (b.getStatus() == BookingStatus.COMPLETED) {
            b.setRefundRequested(true);
            b.setRefundSeatsRequested(b.getRefundSeatsRequested() + toRelease);
        }

        bookingRepository.save(b);

        return CancelBookingResponse.builder()
                .bookingId(b.getId())
                .status(b.getStatus())
                .build();
    }

    /** Called by job */
    public void expireBooking(String bookingId) {
        Booking b = bookingRepository.findById(bookingId).orElse(null);
        if (b == null) return;

        if (b.getStatus() != BookingStatus.PENDING) return;
        if (b.getExpiresAt() == null) return;
        if (!b.getExpiresAt().isBefore(Instant.now())) return;

        int toRelease = b.getNumberOfPeople();
        if (toRelease > 0) {
            sessionSeatOps.releaseSeats(b.getSessionId(), toRelease);
        }

        b.setStatus(BookingStatus.EXPIRED);
        b.setUpdatedAt(Instant.now());
        b.setExpiresAt(null);

        bookingRepository.save(b);
    }

    // ---------- rules ----------
    private void validateSessionBookable(ActivitySession session, String userId) {
        if (session.getStatus() != ActivityStatus.PUBLISHED) {
            throw conflict(BookingErrors.SESSION_NOT_PUBLISHED);
        }
        validateSessionChangeAllowed(session);

        // guide cannot book own session
        if (session.getGuideId() != null && session.getGuideId().equals(userId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, BookingErrors.GUIDE_CANNOT_BOOK_OWN);
        }
    }

    private void validateSessionChangeAllowed(ActivitySession session) {
        Instant now = Instant.now();
        Instant start = session.getDate();
        if (start == null) return;
        if (start.minus(CUTOFF).isBefore(now)) {
            throw conflict(BookingErrors.SESSION_CUTOFF);
        }
    }

    private void assertOwned(Booking b, String userId) {
        if (b.getUserId() == null || !b.getUserId().equals(userId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, BookingErrors.BOOKING_NOT_OWNED);
        }
    }

    private void assertActive(Booking b) {
        if (b.getStatus() == BookingStatus.CANCELLED || b.getStatus() == BookingStatus.EXPIRED) {
            throw conflict(BookingErrors.BOOKING_NOT_ACTIVE);
        }
    }

    // ---------- expiry policy ----------
    // Simple policy:
    // - if session far away (>= 3 days): expires in 24h
    // - if closer (< 3 days): expires in 30 minutes
    // - but never beyond cutoff (start - 5h)
    private Instant computeExpiresAt(Instant sessionDate, Instant now) {
        Duration farThreshold = Duration.ofDays(3);
        Duration hold = sessionDate.isAfter(now.plus(farThreshold)) ? Duration.ofHours(24) : Duration.ofMinutes(30);

        Instant proposed = now.plus(hold);
        Instant latest = sessionDate.minus(CUTOFF);

        return proposed.isAfter(latest) ? latest : proposed;
    }

    // ---------- helpers ----------
    private ResponseStatusException bad(String msg) {
        return new ResponseStatusException(HttpStatus.BAD_REQUEST, msg);
    }

    private ResponseStatusException conflict(String msg) {
        return new ResponseStatusException(HttpStatus.CONFLICT, msg);
    }

    private ResponseStatusException notFound(String msg) {
        return new ResponseStatusException(HttpStatus.NOT_FOUND, msg);
    }

    public List<Booking> listMine(String userId) {
        return bookingRepository.findByUserIdOrderByCreatedAtDesc(userId);
    }
}
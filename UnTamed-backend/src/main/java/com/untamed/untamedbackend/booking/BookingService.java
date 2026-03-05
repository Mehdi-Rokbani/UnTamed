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

    private final BookingRepository bookingRepository;
    private final SessionSeatOps sessionSeatOps;
    private final BookingPolicyProperties policy;

    private Duration cutoff() {
        long h = policy.getCutoffHours();
        return Duration.ofHours(h > 0 ? h : 5);
    }

    private Duration pendingHold() {
        long m = policy.getPendingMinutes();
        return Duration.ofMinutes(m > 0 ? m : 15);
    }

    public String requireUserId(Authentication auth) {
        if (auth == null || !auth.isAuthenticated()) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, BookingErrors.NOT_AUTHENTICATED);
        }
        return auth.getName(); // your system currently uses email as name (fine)
    }

    /**
     * v1 behaviour (payment-ready):
     * - If a PAYING booking exists for (userId, sessionId) => block and force verify flow.
     * - If a PENDING booking exists for (userId, sessionId) => increase seats on that PENDING booking.
     * - If not, create a NEW PENDING booking (even if old COMPLETED bookings exist).
     *
     * This pairs with a DB partial unique index:
     *   unique(userId, sessionId) WHERE status IN (PENDING, PAYING)
     */
    public Booking createOrIncreaseBooking(String userId, String sessionId, int people) {
        if (people < 1) throw bad(BookingErrors.INVALID_PEOPLE);

        ActivitySession session = sessionSeatOps.getSessionOrThrow(sessionId);
        validateSessionBookable(session, userId);

        // 1) If payment is in progress, do not create a new booking (force /payments/verify)
        var payingOpt = bookingRepository.findFirstByUserIdAndSessionIdAndStatus(
                userId, sessionId, BookingStatus.PAYING
        );
        if (payingOpt.isPresent()) {
            // helpful message for frontend behaviour
            throw conflict("Payment in progress. Please verify payment status.");
        }

        // 2) Only reuse PENDING booking (never reuse COMPLETED)
        var pendingOpt = bookingRepository.findFirstByUserIdAndSessionIdAndStatus(
                userId, sessionId, BookingStatus.PENDING
        );

        if (pendingOpt.isPresent()) {
            // NOTE: this refreshes expiresAt (your current behavior).
            // If later you want "expiresAt fixed from first hold", we can change this.
            return increaseSeats(pendingOpt.get().getId(), userId, people);
        }

        // 3) Reserve seats atomically
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
        assertMutableUnpaid(b); // COMPLETED immutable; PAYING locked for changes too

        ActivitySession session = sessionSeatOps.getSessionOrThrow(b.getSessionId());
        validateSessionBookable(session, userId);

        boolean reserved = sessionSeatOps.tryReserveSeats(b.getSessionId(), delta);
        if (!reserved) throw conflict(BookingErrors.SOLD_OUT);

        b.setNumberOfPeople(b.getNumberOfPeople() + delta);
        b.setUpdatedAt(Instant.now());
        b.setExpiresAt(computeExpiresAt(session.getDate(), Instant.now()));

        return bookingRepository.save(b);
    }

    public Booking decreaseSeats(String bookingId, String userId, int delta) {
        if (delta < 1) throw bad(BookingErrors.INVALID_DELTA);

        Booking b = bookingRepository.findById(bookingId)
                .orElseThrow(() -> notFound(BookingErrors.BOOKING_NOT_FOUND));

        assertOwned(b, userId);
        assertMutableUnpaid(b); // COMPLETED immutable; PAYING locked for changes too

        ActivitySession session = sessionSeatOps.getSessionOrThrow(b.getSessionId());
        validateSessionChangeAllowed(session);

        int current = b.getNumberOfPeople();
        if (delta >= current) {
            // decreasing to 0 => cancel
            cancelBooking(bookingId, userId);
            return bookingRepository.findById(bookingId)
                    .orElseThrow(() -> notFound(BookingErrors.BOOKING_NOT_FOUND));
        }

        sessionSeatOps.releaseSeats(b.getSessionId(), delta);

        b.setNumberOfPeople(current - delta);
        b.setUpdatedAt(Instant.now());
        b.setExpiresAt(computeExpiresAt(session.getDate(), Instant.now()));

        return bookingRepository.save(b);
    }

    public CancelBookingResponse cancelBooking(String bookingId, String userId) {
        Booking b = bookingRepository.findById(bookingId)
                .orElseThrow(() -> notFound(BookingErrors.BOOKING_NOT_FOUND));

        assertOwned(b, userId);
        assertMutableUnpaid(b); // COMPLETED immutable; PAYING locked for changes too

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

        // Expiration job only targets PENDING, keep that rule strict.
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

    public List<Booking> listMine(String userId) {
        return bookingRepository.findByUserIdOrderByCreatedAtDesc(userId);
    }

    // ---------------- PAYMENT HOOKS (to be called by PaymentService) ----------------

    /**
     * Move PENDING -> PAYING when /payments/create happens.
     * If already PAYING, returns as-is (idempotent).
     */
    public Booking markPaying(String bookingId, String userId) {
        Booking b = bookingRepository.findById(bookingId)
                .orElseThrow(() -> notFound(BookingErrors.BOOKING_NOT_FOUND));

        assertOwned(b, userId);

        if (b.getStatus() == BookingStatus.COMPLETED) throw conflict(BookingErrors.BOOKING_IMMUTABLE_PAID);
        if (b.getStatus() == BookingStatus.CANCELLED || b.getStatus() == BookingStatus.EXPIRED) {
            throw conflict(BookingErrors.BOOKING_NOT_ACTIVE);
        }

        // If already timed out, expire it immediately
        if (b.getExpiresAt() != null && b.getExpiresAt().isBefore(Instant.now())) {
            expireBooking(b.getId());
            throw conflict("Booking expired");
        }

        if (b.getStatus() == BookingStatus.PAYING) return b;
        if (b.getStatus() != BookingStatus.PENDING) throw conflict("Booking not payable");

        b.setStatus(BookingStatus.PAYING);
        b.setUpdatedAt(Instant.now());
        return bookingRepository.save(b);
    }

    /**
     * Payment success: PAYING -> COMPLETED (idempotent).
     * Important: once COMPLETED, booking is immutable.
     */
    public Booking markCompleted(String bookingId) {
        Booking b = bookingRepository.findById(bookingId).orElse(null);
        if (b == null) return null;

        if (b.getStatus() == BookingStatus.COMPLETED) return b; // idempotent

        // If booking already released, payment came too late; caller decides refund/ignore policy.
        if (b.getStatus() == BookingStatus.CANCELLED || b.getStatus() == BookingStatus.EXPIRED) {
            return b;
        }

        b.setStatus(BookingStatus.COMPLETED);
        b.setExpiresAt(null);
        b.setUpdatedAt(Instant.now());
        return bookingRepository.save(b);
    }

    /**
     * Payment failure: if hold deadline passed => EXPIRED + seats released; else => back to PENDING.
     */
    public Booking handlePaymentFailed(String bookingId) {
        Booking b = bookingRepository.findById(bookingId).orElse(null);
        if (b == null) return null;

        if (b.getStatus() == BookingStatus.COMPLETED) return b; // already paid
        if (b.getStatus() == BookingStatus.CANCELLED || b.getStatus() == BookingStatus.EXPIRED) return b;

        Instant now = Instant.now();
        Instant exp = b.getExpiresAt();

        if (exp != null && exp.isBefore(now)) {
            // expire + release seats
            expireBooking(b.getId());
            return bookingRepository.findById(b.getId()).orElse(null);
        }

        // back to PENDING if we were PAYING
        if (b.getStatus() == BookingStatus.PAYING) {
            b.setStatus(BookingStatus.PENDING);
            b.setUpdatedAt(now);
            return bookingRepository.save(b);
        }

        return b;
    }

    // ---------------- rules ----------------

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

        // block if now is on/after (start - cutoff)
        if (!now.isBefore(start.minus(cutoff()))) {
            throw conflict(BookingErrors.SESSION_CUTOFF);
        }
    }

    private void assertOwned(Booking b, String userId) {
        if (b.getUserId() == null || !b.getUserId().equals(userId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, BookingErrors.BOOKING_NOT_OWNED);
        }
    }

    /**
     * Unpaid bookings that are mutable from the UI.
     * - PENDING: mutable
     * - PAYING: locked (we don't want users changing seats mid-checkout)
     * - COMPLETED: immutable
     */
    private void assertMutableUnpaid(Booking b) {
        if (b.getStatus() == BookingStatus.CANCELLED || b.getStatus() == BookingStatus.EXPIRED) {
            throw conflict(BookingErrors.BOOKING_NOT_ACTIVE);
        }
        if (b.getStatus() == BookingStatus.COMPLETED) {
            throw conflict(BookingErrors.BOOKING_IMMUTABLE_PAID);
        }
        if (b.getStatus() == BookingStatus.PAYING) {
            throw conflict("Payment in progress. Verify payment status first.");
        }
        // only PENDING reaches here
    }

    // ---------------- expiry policy ----------------
    // v1 policy:
    // - Holds expire after pendingMinutes (default 15)
    // - But never beyond cutoff (start - cutoffHours)
    private Instant computeExpiresAt(Instant sessionDate, Instant now) {
        Instant proposed = now.plus(pendingHold());
        Instant latest = sessionDate.minus(cutoff());
        return proposed.isAfter(latest) ? latest : proposed;
    }

    // ---------------- helpers ----------------
    private ResponseStatusException bad(String msg) {
        return new ResponseStatusException(HttpStatus.BAD_REQUEST, msg);
    }

    private ResponseStatusException conflict(String msg) {
        return new ResponseStatusException(HttpStatus.CONFLICT, msg);
    }

    private ResponseStatusException notFound(String msg) {
        return new ResponseStatusException(HttpStatus.NOT_FOUND, msg);
    }
}
package com.untamed.untamedbackend.booking;

import com.untamed.untamedbackend.dto.GuideParticipantDto;
import com.untamed.untamedbackend.model.*;
import com.untamed.untamedbackend.repository.*;
import com.untamed.untamedbackend.review.ReviewEligibilityResponse;
import com.untamed.untamedbackend.security.AuthenticatedUser;
import com.untamed.untamedbackend.service.UserInsightService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Objects;

@Service
@RequiredArgsConstructor
public class BookingService {

    private final BookingRepository bookingRepository;
    private final SessionSeatOps sessionSeatOps;
    private final BookingPolicyProperties policy;
    private final UserRepository userRepository;
    private final ActivityTemplateRepository activityTemplateRepository;
    private final ReviewRepository reviewRepository;
    private final ActivitySessionRepository activitySessionRepository;
    private final UserInsightService userInsightService;
    private final AddressRepository addressRepository;

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
        return auth.getName();
    }

    public Booking createOrIncreaseBooking(String userId, String sessionId, int people, List<String> guestNamesInput) {
        if (people < 1) {
            throw bad(BookingErrors.INVALID_PEOPLE);
        }

        List<String> guestNames = sanitizeAndValidateGuestNames(people, guestNamesInput);

        ActivitySession session = sessionSeatOps.getSessionOrThrow(sessionId);
        validateSessionBookable(session, userId);

        var payingOpt = bookingRepository.findFirstByUserIdAndSessionIdAndStatus(
                userId, sessionId, BookingStatus.PAYING
        );

        if (payingOpt.isPresent()) {
            Booking paying = payingOpt.get();

            if (paying.getExpiresAt() != null && paying.getExpiresAt().isBefore(Instant.now())) {
                expireBooking(paying.getId());
            } else {
                throw conflict("Payment in progress. Please verify payment status.");
            }
        }

        var pendingOpt = bookingRepository.findFirstByUserIdAndSessionIdAndStatus(
                userId, sessionId, BookingStatus.PENDING
        );

        if (pendingOpt.isPresent()) {
            throw conflict("You already have a pending booking for this session. Please cancel it or continue payment.");
        }

        boolean reserved = sessionSeatOps.tryReserveSeats(sessionId, people);
        if (!reserved) {
            throw conflict(BookingErrors.SOLD_OUT);
        }

        Instant now = Instant.now();
        Booking booking = Booking.builder()
                .userId(userId)
                .sessionId(sessionId)
                .numberOfPeople(people)
                .guestNames(guestNames)
                .status(BookingStatus.PENDING)
                .createdAt(now)
                .updatedAt(now)
                .expiresAt(computeExpiresAt(session.getStartAt(), now))
                .build();

        Booking savedBooking = bookingRepository.save(booking);
        userInsightService.onBookingCreated(savedBooking);

        return savedBooking;
    }

    private List<String> sanitizeAndValidateGuestNames(int numberOfPeople, List<String> guestNamesInput) {
        List<String> guestNames = guestNamesInput == null
                ? List.of()
                : guestNamesInput.stream()
                .map(name -> name == null ? "" : name.trim())
                .filter(name -> !name.isBlank())
                .toList();

        int expectedFriendNames = Math.max(0, numberOfPeople - 1);

        if (guestNames.size() != expectedFriendNames) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "You must provide exactly " + expectedFriendNames + " guest name(s)."
            );
        }

        return guestNames;
    }

    private List<String> sanitizeAndValidateFullGuestNames(int numberOfPeople, List<String> guestNamesInput) {
        List<String> guestNames = guestNamesInput == null
                ? List.of()
                : guestNamesInput.stream()
                .map(name -> name == null ? "" : name.trim())
                .toList();

        if (guestNames.size() != numberOfPeople) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "You must provide exactly " + numberOfPeople + " guest name(s)."
            );
        }

        if (guestNames.stream().anyMatch(String::isBlank)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Guest names cannot be blank.");
        }

        return guestNames;
    }

    public Booking updateGuestNames(String bookingId, String userId, List<String> fullGuestNamesInput) {
        Booking b = bookingRepository.findById(bookingId)
                .orElseThrow(() -> notFound(BookingErrors.BOOKING_NOT_FOUND));

        assertOwned(b, userId);
        if (b.getStatus() != BookingStatus.PENDING && b.getStatus() != BookingStatus.PAYING) {
            throw conflict("Guest names can only be updated before payment is completed.");
        }

        List<String> fullGuestNames = sanitizeAndValidateFullGuestNames(
                b.getNumberOfPeople(),
                fullGuestNamesInput
        );

        b.setGuestNames(fullGuestNames.stream().skip(1).toList());
        b.setUpdatedAt(Instant.now());

        return bookingRepository.save(b);
    }

    public Booking increaseSeats(String bookingId, String userId, int delta) {
        if (delta < 1) {
            throw bad(BookingErrors.INVALID_DELTA);
        }

        Booking b = bookingRepository.findById(bookingId)
                .orElseThrow(() -> notFound(BookingErrors.BOOKING_NOT_FOUND));

        assertOwned(b, userId);
        assertMutableUnpaid(b);

        ActivitySession session = sessionSeatOps.getSessionOrThrow(b.getSessionId());
        validateSessionBookable(session, userId);

        boolean reserved = sessionSeatOps.tryReserveSeats(b.getSessionId(), delta);
        if (!reserved) {
            throw conflict(BookingErrors.SOLD_OUT);
        }

        b.setNumberOfPeople(b.getNumberOfPeople() + delta);
        b.setUpdatedAt(Instant.now());
        b.setExpiresAt(computeExpiresAt(session.getStartAt(), Instant.now()));

        return bookingRepository.save(b);
    }

    public Booking decreaseSeats(String bookingId, String userId, int delta) {
        if (delta < 1) {
            throw bad(BookingErrors.INVALID_DELTA);
        }

        Booking b = bookingRepository.findById(bookingId)
                .orElseThrow(() -> notFound(BookingErrors.BOOKING_NOT_FOUND));

        assertOwned(b, userId);
        assertMutableUnpaid(b);

        ActivitySession session = sessionSeatOps.getSessionOrThrow(b.getSessionId());
        validateSessionChangeAllowed(session);

        int current = b.getNumberOfPeople();
        if (delta >= current) {
            cancelBooking(bookingId, userId);
            return bookingRepository.findById(bookingId)
                    .orElseThrow(() -> notFound(BookingErrors.BOOKING_NOT_FOUND));
        }

        sessionSeatOps.releaseSeats(b.getSessionId(), delta);

        b.setNumberOfPeople(current - delta);
        b.setUpdatedAt(Instant.now());
        b.setExpiresAt(computeExpiresAt(session.getStartAt(), Instant.now()));

        return bookingRepository.save(b);
    }

    public CancelBookingResponse cancelBooking(String bookingId, String userId) {
        Booking b = bookingRepository.findById(bookingId)
                .orElseThrow(() -> notFound(BookingErrors.BOOKING_NOT_FOUND));

        assertOwned(b, userId);
        assertMutableForCancel(b);

        ActivitySession session = sessionSeatOps.getSessionOrThrow(b.getSessionId());
        validateSessionChangeAllowed(session);

        boolean wasCompletedAndPresent =
                b.getStatus() == BookingStatus.COMPLETED && !Boolean.TRUE.equals(b.isAttendanceMarkedAbsent());

        int toRelease = b.getNumberOfPeople();
        if (toRelease > 0) {
            sessionSeatOps.releaseSeats(b.getSessionId(), toRelease);
        }

        b.setNumberOfPeople(0);
        b.setStatus(BookingStatus.CANCELLED);
        b.setUpdatedAt(Instant.now());
        b.setExpiresAt(null);

        Booking savedBooking = bookingRepository.save(b);
        userInsightService.onBookingCancelled(savedBooking);

        if (wasCompletedAndPresent) {
            decrementConfirmedTripsCount(savedBooking.getUserId());
        }

        return CancelBookingResponse.builder()
                .bookingId(savedBooking.getId())
                .status(savedBooking.getStatus())
                .build();
    }
    public void expireBooking(String bookingId) {
        Booking b = bookingRepository.findById(bookingId).orElse(null);
        if (b == null) return;

        if (b.getStatus() != BookingStatus.PENDING && b.getStatus() != BookingStatus.PAYING) {
            return;
        }

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

    public Booking markPaying(String bookingId, String userId) {
        Booking b = bookingRepository.findById(bookingId)
                .orElseThrow(() -> notFound(BookingErrors.BOOKING_NOT_FOUND));

        assertOwned(b, userId);

        if (b.getStatus() == BookingStatus.COMPLETED) {
            throw conflict(BookingErrors.BOOKING_IMMUTABLE_PAID);
        }
        if (b.getStatus() == BookingStatus.CANCELLED || b.getStatus() == BookingStatus.EXPIRED) {
            throw conflict(BookingErrors.BOOKING_NOT_ACTIVE);
        }

        if (b.getExpiresAt() != null && b.getExpiresAt().isBefore(Instant.now())) {
            expireBooking(b.getId());
            throw conflict("Booking expired");
        }

        if (b.getStatus() == BookingStatus.PAYING) {
            return b;
        }
        if (b.getStatus() != BookingStatus.PENDING) {
            throw conflict("Booking not payable");
        }

        b.setStatus(BookingStatus.PAYING);
        b.setUpdatedAt(Instant.now());
        return bookingRepository.save(b);
    }

    public Booking markCompleted(String bookingId) {
        Booking b = bookingRepository.findById(bookingId).orElse(null);

        if (b == null) {
            return null;
        }

        if (b.getStatus() == BookingStatus.COMPLETED) {
            return b;
        }

        if (b.getStatus() == BookingStatus.CANCELLED || b.getStatus() == BookingStatus.EXPIRED) {
            return b;
        }

        b.setStatus(BookingStatus.COMPLETED);
        b.setExpiresAt(null);
        b.setUpdatedAt(Instant.now());

        Booking savedBooking = bookingRepository.save(b);
        userInsightService.onBookingCompleted(savedBooking);
        incrementConfirmedTripsCount(savedBooking.getUserId());

        return savedBooking;
    }

    public Booking handlePaymentFailed(String bookingId) {
        Booking b = bookingRepository.findById(bookingId).orElse(null);
        if (b == null) return null;

        if (b.getStatus() == BookingStatus.COMPLETED) return b;
        if (b.getStatus() == BookingStatus.CANCELLED || b.getStatus() == BookingStatus.EXPIRED) return b;

        Instant now = Instant.now();
        Instant exp = b.getExpiresAt();

        if (exp != null && exp.isBefore(now)) {
            expireBooking(b.getId());
            return bookingRepository.findById(b.getId()).orElse(null);
        }

        if (b.getStatus() == BookingStatus.PAYING) {
            b.setStatus(BookingStatus.PENDING);
            b.setUpdatedAt(now);
            return bookingRepository.save(b);
        }

        return b;
    }

    private void validateSessionBookable(ActivitySession session, String userId) {
        if (session.getStatus() != ActivityStatus.PUBLISHED) {
            throw conflict(BookingErrors.SESSION_NOT_PUBLISHED);
        }
        validateSessionChangeAllowed(session);

        if (session.getGuideId() != null && session.getGuideId().equals(userId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, BookingErrors.GUIDE_CANNOT_BOOK_OWN);
        }
    }

    private void validateSessionChangeAllowed(ActivitySession session) {
        Instant now = Instant.now();
        Instant start = session.getStartAt();
        if (start == null) return;

        if (!now.isBefore(start.minus(cutoff()))) {
            throw conflict(BookingErrors.SESSION_CUTOFF);
        }
    }

    private void assertOwned(Booking b, String userId) {
        if (b.getUserId() == null || !String.valueOf(b.getUserId()).equals(userId)) {
            throw new org.springframework.security.access.AccessDeniedException("Not your booking");
        }
    }

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
    }

    private void assertMutableForCancel(Booking b) {
        if (b.getStatus() == BookingStatus.CANCELLED || b.getStatus() == BookingStatus.EXPIRED) {
            throw conflict(BookingErrors.BOOKING_NOT_ACTIVE);
        }
        if (b.getStatus() == BookingStatus.PAYING) {
            throw conflict("Payment in progress. Verify payment status first.");
        }
    }

    private Instant computeExpiresAt(Instant sessionStartAt, Instant now) {
        Instant proposed = now.plus(pendingHold());
        Instant latest = sessionStartAt.minus(cutoff());
        return proposed.isAfter(latest) ? latest : proposed;
    }

    private ResponseStatusException bad(String msg) {
        return new ResponseStatusException(HttpStatus.BAD_REQUEST, msg);
    }

    private ResponseStatusException conflict(String msg) {
        return new ResponseStatusException(HttpStatus.CONFLICT, msg);
    }

    private ResponseStatusException notFound(String msg) {
        return new ResponseStatusException(HttpStatus.NOT_FOUND, msg);
    }

    public Booking confirmBooking(String bookingId, String userId) {
        Booking b = bookingRepository.findById(bookingId)
                .orElseThrow(() -> notFound(BookingErrors.BOOKING_NOT_FOUND));

        assertOwned(b, userId);

        if (b.getStatus() == BookingStatus.COMPLETED) {
            return b;
        }

        if (b.getStatus() == BookingStatus.CANCELLED || b.getStatus() == BookingStatus.EXPIRED) {
            throw conflict(BookingErrors.BOOKING_NOT_ACTIVE);
        }

        if (b.getStatus() == BookingStatus.PAYING) {
            throw conflict("Payment in progress. Cannot confirm booking now.");
        }

        if (b.getStatus() != BookingStatus.PENDING) {
            throw conflict("Only pending bookings can be confirmed.");
        }

        if (b.getExpiresAt() != null && b.getExpiresAt().isBefore(Instant.now())) {
            expireBooking(b.getId());
            throw conflict("Booking expired");
        }

        ActivitySession session = sessionSeatOps.getSessionOrThrow(b.getSessionId());
        validateSessionChangeAllowed(session);

        b.setStatus(BookingStatus.COMPLETED);
        b.setExpiresAt(null);
        b.setUpdatedAt(Instant.now());

        Booking savedBooking = bookingRepository.save(b);
        userInsightService.onBookingCompleted(savedBooking);
        incrementConfirmedTripsCount(savedBooking.getUserId());

        return savedBooking;
    }

    public String requireAuthenticatedDbUserId(Authentication auth) {
        if (auth == null || !auth.isAuthenticated()) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, BookingErrors.NOT_AUTHENTICATED);
        }

        Object principal = auth.getPrincipal();
        if (principal instanceof AuthenticatedUser authenticatedUser) {
            return authenticatedUser.getId();
        }

        throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Authenticated user ID not available.");
    }

    public List<GuideParticipantDto> listParticipantsForGuide(String sessionId, String guideId) {
        ActivitySession session = sessionSeatOps.getSessionOrThrow(sessionId);

        if (session.getGuideId() == null || !session.getGuideId().equals(guideId)) {
            throw new ResponseStatusException(
                    HttpStatus.FORBIDDEN,
                    "You can only view participants for your own sessions."
            );
        }

        List<Booking> bookings = bookingRepository
                .findBySessionIdAndStatusOrderByCreatedAtAsc(sessionId, BookingStatus.COMPLETED);

        return bookings.stream().map(booking -> {
            User user = userRepository.findById(booking.getUserId()).orElse(null);

            return new GuideParticipantDto(
                    booking.getId(),
                    booking.getUserId(),
                    user != null ? user.getUsername() : null,
                    user != null ? user.getEmail() : null,
                    user != null ? user.getProfileImageUrl() : null,
                    booking.getNumberOfPeople(),
                    booking.getStatus(),
                    booking.getCreatedAt(),
                    List.of()
            );
        }).toList();
    }

    public List<GuideParticipantDto> listAllBookingsForGuide(String sessionId, String guideId) {
        ActivitySession session = sessionSeatOps.getSessionOrThrow(sessionId);

        if (session.getGuideId() == null || !session.getGuideId().equals(guideId)) {
            throw new ResponseStatusException(
                    HttpStatus.FORBIDDEN,
                    "You can only view bookings for your own sessions."
            );
        }

        List<Booking> bookings = bookingRepository.findBySessionIdOrderByCreatedAtAsc(sessionId);

        return bookings.stream().map(booking -> {
            User user = userRepository.findById(booking.getUserId()).orElse(null);

            return new GuideParticipantDto(
                    booking.getId(),
                    booking.getUserId(),
                    user != null ? user.getUsername() : null,
                    user != null ? user.getEmail() : booking.getUserId(),
                    user != null ? user.getProfileImageUrl() : null,
                    booking.getNumberOfPeople(),
                    booking.getStatus(),
                    booking.getCreatedAt(),
                    List.of()
            );
        }).toList();
    }

    public CancelBookingResponse cancelPendingBookingByGuide(String bookingId, String guideId) {
        Booking b = bookingRepository.findById(bookingId)
                .orElseThrow(() -> notFound(BookingErrors.BOOKING_NOT_FOUND));

        ActivitySession session = sessionSeatOps.getSessionOrThrow(b.getSessionId());

        if (session.getGuideId() == null || !session.getGuideId().equals(guideId)) {
            throw new ResponseStatusException(
                    HttpStatus.FORBIDDEN,
                    "You can only manage bookings for your own sessions."
            );
        }

        if (b.getStatus() != BookingStatus.PENDING) {
            throw conflict("Only pending bookings can be cancelled by the guide.");
        }

        validateSessionChangeAllowed(session);

        int toRelease = b.getNumberOfPeople();
        if (toRelease > 0) {
            sessionSeatOps.releaseSeats(b.getSessionId(), toRelease);
        }

        b.setNumberOfPeople(0);
        b.setStatus(BookingStatus.CANCELLED);
        b.setUpdatedAt(Instant.now());
        b.setExpiresAt(null);

        Booking savedBooking = bookingRepository.save(b);
        userInsightService.onBookingCancelled(savedBooking);

        return CancelBookingResponse.builder()
                .bookingId(savedBooking.getId())
                .status(savedBooking.getStatus())
                .build();
    }

    public Booking markAttendanceAbsent(String bookingId, String guideId, boolean absent) {
        Booking b = bookingRepository.findById(bookingId)
                .orElseThrow(() -> notFound(BookingErrors.BOOKING_NOT_FOUND));

        ActivitySession session = sessionSeatOps.getSessionOrThrow(b.getSessionId());

        if (session.getGuideId() == null || !session.getGuideId().equals(guideId)) {
            throw new ResponseStatusException(
                    HttpStatus.FORBIDDEN,
                    "You can only manage attendance for your own sessions."
            );
        }

        if (b.getStatus() != BookingStatus.COMPLETED) {
            throw conflict("Only completed bookings can have attendance marked.");
        }

        boolean wasAbsent = Boolean.TRUE.equals(b.isAttendanceMarkedAbsent());

        b.setAttendanceMarkedAbsent(absent);
        b.setAttendanceMarkedAt(Instant.now());
        b.setAttendanceMarkedByGuideId(guideId);

        Booking savedBooking = bookingRepository.save(b);

        if (!wasAbsent && absent) {
            decrementConfirmedTripsCount(savedBooking.getUserId());
        } else if (wasAbsent && !absent) {
            incrementConfirmedTripsCount(savedBooking.getUserId());
        }

        return savedBooking;
    }

    public ReviewEligibilityResponse getReviewEligibility(String bookingId, String userId) {
        Booking b = bookingRepository.findById(bookingId)
                .orElseThrow(() -> notFound(BookingErrors.BOOKING_NOT_FOUND));

        assertOwned(b, userId);

        ActivitySession session = sessionSeatOps.getSessionOrThrow(b.getSessionId());

        ActivityTemplate template = activityTemplateRepository.findById(session.getTemplateId())
                .orElseThrow(() -> notFound("Activity template not found"));

        if (template.getGuideId() != null && template.getGuideId().equals(userId)) {
            return ReviewEligibilityResponse.builder()
                    .eligible(false)
                    .alreadyReviewed(false)
                    .activityTemplateId(template.getId())
                    .reason("Guide cannot review their own activity.")
                    .build();
        }

        if (b.getStatus() != BookingStatus.COMPLETED) {
            return ReviewEligibilityResponse.builder()
                    .eligible(false)
                    .alreadyReviewed(false)
                    .activityTemplateId(template.getId())
                    .reason("Only completed bookings can be reviewed.")
                    .build();
        }

        if (b.isAttendanceMarkedAbsent()) {
            return ReviewEligibilityResponse.builder()
                    .eligible(false)
                    .alreadyReviewed(false)
                    .activityTemplateId(template.getId())
                    .reason("Absent participants cannot leave reviews.")
                    .build();
        }

        if (session.getStartAt() == null || !session.getStartAt().isBefore(Instant.now())) {
            return ReviewEligibilityResponse.builder()
                    .eligible(false)
                    .alreadyReviewed(false)
                    .activityTemplateId(template.getId())
                    .reason("You can review only after the session date has passed.")
                    .build();
        }

        Review existing = reviewRepository
                .findByReviewerIdAndActivityTemplateId(userId, template.getId())
                .orElse(null);

        if (existing != null) {
            return ReviewEligibilityResponse.builder()
                    .eligible(true)
                    .alreadyReviewed(true)
                    .existingReviewId(existing.getId())
                    .activityTemplateId(template.getId())
                    .reason("You already reviewed this activity.")
                    .build();
        }

        return ReviewEligibilityResponse.builder()
                .eligible(true)
                .alreadyReviewed(false)
                .existingReviewId(null)
                .activityTemplateId(template.getId())
                .reason("Eligible to review.")
                .build();
    }

    private void incrementConfirmedTripsCount(String userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> notFound("User not found"));

        user.setConfirmedTripsCount(user.getConfirmedTripsCount() + 1);
        userRepository.save(user);
    }

    private void decrementConfirmedTripsCount(String userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> notFound("User not found"));

        user.setConfirmedTripsCount(Math.max(0, user.getConfirmedTripsCount() - 1));
        userRepository.save(user);
    }

    public ParticipantsPreviewResponse getParticipantsPreview(String sessionId) {
        ActivitySession session = activitySessionRepository.findById(sessionId)
                .orElseThrow(() -> new IllegalArgumentException("Session not found"));

        List<Booking> confirmedBookings = bookingRepository.findBySessionIdAndStatus(sessionId, BookingStatus.COMPLETED);

        List<ParticipantPreviewItem> participants = confirmedBookings.stream()
                .map(booking -> userRepository.findById(booking.getUserId()).orElse(null))
                .filter(Objects::nonNull)
                .limit(5)
                .map(user -> ParticipantPreviewItem.builder()
                        .userId(user.getId())
                        .username(user.getUsername())
                        .profileImageUrl(user.getProfileImageUrl())
                        .level(user.getLevel() != null ? user.getLevel().name() : null)
                        .build())
                .toList();

        int totalConfirmed = confirmedBookings.size();
        int capacity = session.getCapacity();
        int seatsLeft = Math.max(capacity - totalConfirmed, 0);

        return ParticipantsPreviewResponse.builder()
                .totalConfirmed(totalConfirmed)
                .seatsLeft(seatsLeft)
                .participants(participants)
                .build();
    }
    public Booking handlePaymentFailed(String bookingId, String userId) {
        Booking b = bookingRepository.findById(bookingId)
                .orElseThrow(() -> notFound(BookingErrors.BOOKING_NOT_FOUND));

        assertOwned(b, userId);

        if (b.getStatus() == BookingStatus.COMPLETED) return b;
        if (b.getStatus() == BookingStatus.CANCELLED || b.getStatus() == BookingStatus.EXPIRED) return b;

        Instant now = Instant.now();
        Instant exp = b.getExpiresAt();

        if (exp != null && exp.isBefore(now)) {
            expireBooking(b.getId());
            return bookingRepository.findById(b.getId()).orElse(null);
        }

        if (b.getStatus() == BookingStatus.PAYING) {
            b.setStatus(BookingStatus.PENDING);
            b.setUpdatedAt(now);
            return bookingRepository.save(b);
        }

        return b;
    }

    public List<BookingWithDetailsDto> listMineWithDetails(String userId) {
        List<Booking> bookings = bookingRepository.findByUserIdOrderByCreatedAtDesc(userId);

        return bookings.stream().map(b -> {
            // Defaults
            String activityTitle    = null;
            String activityImageUrl = null;
            Instant sessionStartAt  = null;
            String displayName      = null;
            String governorate      = null;
            String locality         = null;
            Double latitude         = null;
            Double longitude        = null;
            BigDecimal pricePerPerson = null;
            BigDecimal totalPrice     = null;

            // Resolve session
            ActivitySession session = activitySessionRepository
                    .findById(b.getSessionId())
                    .orElse(null);

            if (session != null) {
                sessionStartAt = session.getStartAt();

                // Resolve template
                ActivityTemplate template = activityTemplateRepository
                        .findById(session.getTemplateId())
                        .orElse(null);

                if (template != null) {
                    activityTitle = template.getTitle();

                    pricePerPerson = template.getPrice();
                    totalPrice = pricePerPerson != null
                            ? pricePerPerson.multiply(BigDecimal.valueOf(b.getNumberOfPeople()))
                            : null;

                    // Cover image: first image with cover=true, else first image overall
                    if (template.getImages() != null && !template.getImages().isEmpty()) {
                        activityImageUrl = template.getImages().stream()
                                .filter(img -> Boolean.TRUE.equals(img.isCover()))
                                .findFirst()
                                .or(() -> template.getImages().stream().findFirst())
                                .map(img -> img.getUrl())
                                .orElse(null);
                    }

                    // Resolve address
                    if (template.getAddressId() != null) {
                        Address address = addressRepository
                                .findById(template.getAddressId())
                                .orElse(null);

                        if (address != null) {
                            displayName = address.getDisplayName();
                            governorate = address.getGovernorate();
                            locality    = address.getLocality();
                            latitude    = address.getLatitude();
                            longitude   = address.getLongitude();
                        }
                    }
                }
            }

            return new BookingWithDetailsDto(
                    b.getId(),
                    b.getUserId(),
                    b.getSessionId(),
                    b.getNumberOfPeople(),
                    b.getGuestNames() == null ? List.of() : b.getGuestNames(),
                    b.getStatus(),
                    b.getCreatedAt(),
                    b.getUpdatedAt(),
                    b.getExpiresAt(),
                    activityTitle,
                    activityImageUrl,
                    sessionStartAt,
                    displayName,
                    governorate,
                    locality,
                    latitude,
                    longitude,
                    pricePerPerson,
                    totalPrice
            );
        }).toList();
    }
}

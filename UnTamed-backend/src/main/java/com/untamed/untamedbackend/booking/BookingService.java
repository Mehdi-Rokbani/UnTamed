package com.untamed.untamedbackend.booking;

import com.untamed.untamedbackend.dto.GuideParticipantDto;
import com.untamed.untamedbackend.dto.MeetingPointDto;
import com.untamed.untamedbackend.chat.ChatService;
import com.untamed.untamedbackend.guestpass.GuestPass;
import com.untamed.untamedbackend.guestpass.GuestPassRepository;
import com.untamed.untamedbackend.model.*;
import com.untamed.untamedbackend.notification.NotificationService;
import com.untamed.untamedbackend.notification.NotificationSeverity;
import com.untamed.untamedbackend.notification.NotificationType;
import com.untamed.untamedbackend.payment.PaymentAttempt;
import com.untamed.untamedbackend.payment.PaymentAttemptRepository;
import com.untamed.untamedbackend.payment.PaymentAttemptStatus;
import com.untamed.untamedbackend.payment.PaymentProvider;
import com.untamed.untamedbackend.payment.stripe.StripeRefundService;
import com.untamed.untamedbackend.repository.*;
import com.untamed.untamedbackend.review.ReviewEligibilityResponse;
import com.untamed.untamedbackend.revenue.RevenueService;
import com.untamed.untamedbackend.security.AuthenticatedUser;
import com.untamed.untamedbackend.service.LevelingService;
import com.untamed.untamedbackend.service.UserInsightService;
import com.untamed.untamedbackend.service.GuideAccessService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;

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

    private final RefundPolicyService refundPolicyService;
    private final PaymentAttemptRepository paymentAttemptRepository;
    private final GuestPassRepository guestPassRepository;
    private final StripeRefundService stripeRefundService;
    private final LevelingService levelingService;
    private final NotificationService notificationService;
    private final ChatService chatService;
    private final GuideAccessService guideAccessService;
    private final RevenueService revenueService;

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
        refundPolicyService.assertBeforeSessionStart(session);

        PaymentAttempt attempt = findSucceededStripeAttemptOrNull(b.getId());

        RefundPreviewResponse preview =
                refundPolicyService.previewUserCancellation(b, session, attempt);

        boolean wasCompleted = b.getStatus() == BookingStatus.COMPLETED;
        boolean wasCompletedAndPresent =
                wasCompleted && !Boolean.TRUE.equals(b.isAttendanceMarkedAbsent());

        int toRelease = b.getNumberOfPeople();
        if (toRelease > 0) {
            sessionSeatOps.releaseSeats(b.getSessionId(), toRelease);
        }

        String stripeRefundId = null;

        if (b.getStatus() == BookingStatus.COMPLETED && preview.refundable()) {
            revenueService.assertBookingRevenueRefundAdjustable(b.getId());
            try {
                stripeRefundId = stripeRefundService.refundPaymentAttempt(
                        attempt,
                        preview.refundAmount(),
                        "USER_CANCELLED"
                );

                preview = RefundPreviewResponse.builder()
                        .refundable(preview.refundable())
                        .refundPercent(preview.refundPercent())
                        .refundAmount(preview.refundAmount())
                        .currency(preview.currency())
                        .refundStatus(preview.refundPercent() == 100
                                ? RefundStatus.REFUNDED
                                : RefundStatus.PARTIALLY_REFUNDED)
                        .reason(preview.reason())
                        .build();

            } catch (RuntimeException e) {
                b.setRefundStatus(RefundStatus.REFUND_FAILED);
                b.setUpdatedAt(Instant.now());
                bookingRepository.save(b);
                notifyRefundOutcome(b, CancelledBy.USER);
                throw e;
            }
        }

        applyCancellationMetadata(
                b,
                CancelledBy.USER,
                "User cancelled booking",
                preview,
                stripeRefundId
        );

        Booking savedBooking = bookingRepository.save(b);
        adjustRevenueAfterRefund(savedBooking);
        if (wasCompleted) {
            sendChatRemovalEvent(savedBooking);
        }
        syncChatRoomParticipants(savedBooking.getSessionId());
        if (wasCompleted) {
            createChatSystemMessage(savedBooking.getSessionId(), usernameForSystemMessage(savedBooking) + " left the group.");
        }
        cancelGuestPasses(savedBooking.getId());
        levelingService.recalculateUserLevel(savedBooking.getUserId());
        notifyRefundOutcome(savedBooking, CancelledBy.USER);
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

        ActivitySession session = sessionSeatOps.getSessionOrThrow(b.getSessionId());
        validateSessionBookable(session, userId);

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

        BookingStatus oldStatus = b.getStatus();

        b.setStatus(BookingStatus.COMPLETED);
        b.setExpiresAt(null);
        b.setUpdatedAt(Instant.now());

        Booking savedBooking = bookingRepository.save(b);
        userInsightService.onBookingCompleted(savedBooking);
        levelingService.recalculateUserLevel(savedBooking.getUserId());
        incrementConfirmedTripsCount(savedBooking.getUserId());
        notifyBookingConfirmedIfFirstTransition(savedBooking, oldStatus);
        syncChatRoomParticipants(savedBooking.getSessionId());
        createChatSystemMessage(savedBooking.getSessionId(), usernameForSystemMessage(savedBooking) + " joined the group.");
        recordRevenueForPaidBooking(savedBooking.getId());

        return savedBooking;
    }

    public Booking markCompletedFromPayment(String bookingId) {
        Booking b = bookingRepository.findById(bookingId).orElse(null);

        if (b == null) {
            return null;
        }

        if (b.getStatus() == BookingStatus.COMPLETED) {
            recordRevenueForPaidBooking(b.getId());
            return b;
        }

        if (b.getStatus() == BookingStatus.CANCELLED || b.getStatus() == BookingStatus.EXPIRED) {
            return b;
        }

        ActivitySession session = sessionSeatOps.getSessionOrThrow(b.getSessionId());

        try {
            validateSessionBookable(session, b.getUserId());
        } catch (ResponseStatusException e) {
            System.out.println(
                    "Payment succeeded but booking was not completed because the session is unavailable. "
                            + "Manual admin review required. bookingId=" + bookingId
                            + ", sessionId=" + b.getSessionId()
                            + ", reason=" + e.getReason()
            );
            // TODO: Admin Cancel Session / payment review workflow should decide cancellation or refund.
            return b;
        }

        Booking completed = markCompleted(bookingId);
        if (completed != null && completed.getStatus() == BookingStatus.COMPLETED) {
            recordRevenueForPaidBooking(completed.getId());
        }
        return completed;
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

    private void validateSessionBookable(ActivitySession session, String userId) {
        if (session.getStatus() != ActivityStatus.PUBLISHED) {
            throw conflict(BookingErrors.SESSION_NOT_PUBLISHED);
        }

        ActivityTemplate template = activityTemplateRepository.findById(session.getTemplateId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Activity template not found"));
        if (template.isArchived()) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "This session is currently unavailable.");
        }

        validateSessionChangeAllowed(session);

        if (session.getGuideId() != null && session.getGuideId().equals(userId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, BookingErrors.GUIDE_CANNOT_BOOK_OWN);
        }

        if (!guideAccessService.isPubliclyBookableGuide(session.getGuideId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "This session is currently unavailable.");
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

        BookingStatus oldStatus = b.getStatus();

        b.setStatus(BookingStatus.COMPLETED);
        b.setExpiresAt(null);
        b.setUpdatedAt(Instant.now());

        Booking savedBooking = bookingRepository.save(b);
        userInsightService.onBookingCompleted(savedBooking);
        levelingService.recalculateUserLevel(savedBooking.getUserId());
        incrementConfirmedTripsCount(savedBooking.getUserId());
        notifyBookingConfirmedIfFirstTransition(savedBooking, oldStatus);
        syncChatRoomParticipants(savedBooking.getSessionId());
        createChatSystemMessage(savedBooking.getSessionId(), usernameForSystemMessage(savedBooking) + " joined the group.");

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

    public String requireAuthenticatedActiveGuideId(Authentication auth) {
        String userId = requireAuthenticatedDbUserId(auth);
        guideAccessService.requireActiveGuideById(userId);
        return userId;
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
        ActivityTemplate template = activityTemplateRepository.findById(session.getTemplateId()).orElse(null);

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
                    totalAmountMinor(template, booking),
                    "TND",
                    booking.getRefundStatus(),
                    booking.getRefundPercent(),
                    booking.getRefundAmount(),
                    booking.getRefundCurrency(),
                    booking.getCancelledBy(),
                    booking.getCancellationReason(),
                    booking.getCancelledAt(),
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
        ActivityTemplate template = activityTemplateRepository.findById(session.getTemplateId()).orElse(null);

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
                    totalAmountMinor(template, booking),
                    "TND",
                    booking.getRefundStatus(),
                    booking.getRefundPercent(),
                    booking.getRefundAmount(),
                    booking.getRefundCurrency(),
                    booking.getCancelledBy(),
                    booking.getCancellationReason(),
                    booking.getCancelledAt(),
                    List.of()
            );
        }).toList();
    }

    private int totalAmountMinor(ActivityTemplate template, Booking booking) {
        if (template == null || template.getPrice() == null || booking == null) {
            return 0;
        }

        return template.getPrice()
                .multiply(BigDecimal.valueOf(Math.max(0, booking.getNumberOfPeople())))
                .multiply(BigDecimal.valueOf(100))
                .setScale(0, RoundingMode.HALF_UP)
                .intValue();
    }

    public CancelBookingResponse cancelPendingBookingByGuide(String bookingId, String guideId) {
        return removeBookingByGuide(bookingId, guideId, "Guide cancelled pending booking");
    }

    public CancelBookingResponse removeBookingByGuide(String bookingId, String guideId, String reason) {
        Booking b = bookingRepository.findById(bookingId)
                .orElseThrow(() -> notFound(BookingErrors.BOOKING_NOT_FOUND));

        ActivitySession session = sessionSeatOps.getSessionOrThrow(b.getSessionId());

        if (session.getGuideId() == null || !session.getGuideId().equals(guideId)) {
            throw new ResponseStatusException(
                    HttpStatus.FORBIDDEN,
                    "You can only manage bookings for your own sessions."
            );
        }

        refundPolicyService.assertBeforeSessionStart(session);

        if (b.getStatus() == BookingStatus.CANCELLED || b.getStatus() == BookingStatus.EXPIRED) {
            throw conflict(BookingErrors.BOOKING_NOT_ACTIVE);
        }

        if (b.getStatus() == BookingStatus.PAYING) {
            throw conflict("Payment in progress. Verify payment status first.");
        }

        PaymentAttempt attempt = findSucceededStripeAttemptOrNull(b.getId());

        RefundPreviewResponse preview =
                refundPolicyService.previewGuideRemoval(b, session, attempt);

        boolean wasCompleted = b.getStatus() == BookingStatus.COMPLETED;
        boolean wasCompletedAndPresent =
                wasCompleted && !Boolean.TRUE.equals(b.isAttendanceMarkedAbsent());

        int toRelease = b.getNumberOfPeople();
        if (toRelease > 0) {
            sessionSeatOps.releaseSeats(b.getSessionId(), toRelease);
        }

        String stripeRefundId = null;

        if (b.getStatus() == BookingStatus.COMPLETED && preview.refundable()) {
            revenueService.assertBookingRevenueRefundAdjustable(b.getId());
            try {
                stripeRefundId = stripeRefundService.refundPaymentAttempt(
                        attempt,
                        preview.refundAmount(),
                        "GUIDE_REMOVED_USER"
                );

                preview = RefundPreviewResponse.builder()
                        .refundable(true)
                        .refundPercent(100)
                        .refundAmount(preview.refundAmount())
                        .currency(preview.currency())
                        .refundStatus(RefundStatus.REFUNDED)
                        .reason(preview.reason())
                        .build();

            } catch (RuntimeException e) {
                b.setRefundStatus(RefundStatus.REFUND_FAILED);
                b.setUpdatedAt(Instant.now());
                bookingRepository.save(b);
                notifyRefundOutcome(b, CancelledBy.GUIDE);
                throw e;
            }
        }

        applyCancellationMetadata(
                b,
                CancelledBy.GUIDE,
                reason == null || reason.isBlank() ? "Guide removed participant" : reason.trim(),
                preview,
                stripeRefundId
        );

        Booking savedBooking = bookingRepository.save(b);
        adjustRevenueAfterRefund(savedBooking);
        if (wasCompleted) {
            sendChatRemovalEvent(savedBooking);
        }
        syncChatRoomParticipants(savedBooking.getSessionId());
        if (wasCompleted) {
            createChatSystemMessage(savedBooking.getSessionId(), usernameForSystemMessage(savedBooking) + " left the group.");
        }
        cancelGuestPasses(savedBooking.getId());
        levelingService.recalculateUserLevel(savedBooking.getUserId());
        notifyRefundOutcome(savedBooking, CancelledBy.GUIDE);
        userInsightService.onBookingCancelled(savedBooking);

        if (wasCompletedAndPresent) {
            decrementConfirmedTripsCount(savedBooking.getUserId());
        }

        return CancelBookingResponse.builder()
                .bookingId(savedBooking.getId())
                .status(savedBooking.getStatus())
                .build();
    }
    private void notifyRefundOutcome(Booking booking, CancelledBy cancelledBy) {
        if (booking == null || isBlank(booking.getUserId())) {
            return;
        }

        try {
            BookingNotificationContext context = buildBookingNotificationContext(booking);
            String activityTitle = context.activityTitle();

            RefundStatus refundStatus = booking.getRefundStatus();
            boolean guideCancelled = cancelledBy == CancelledBy.GUIDE;

            if (refundStatus == RefundStatus.REFUNDED || refundStatus == RefundStatus.PARTIALLY_REFUNDED) {
                boolean partial = refundStatus == RefundStatus.PARTIALLY_REFUNDED;
                String title = guideCancelled
                        ? "Booking cancelled by guide"
                        : partial ? "Partial refund approved" : "Refund approved";
                String message = buildRefundApprovedMessage(booking, activityTitle, partial, guideCancelled);

                notificationService.createAndSendIfAbsent(
                        booking.getUserId(),
                        NotificationType.REFUND_APPROVED,
                        title,
                        message,
                        NotificationSeverity.SUCCESS,
                        "/my-bookings",
                        "BOOKING",
                        booking.getId()
                );

                return;
            }

            if (refundStatus == RefundStatus.NOT_REFUNDABLE) {
                notificationService.createAndSendIfAbsent(
                        booking.getUserId(),
                        NotificationType.REFUND_REJECTED,
                        guideCancelled ? "Booking cancelled by guide" : "Booking cancelled",
                        guideCancelled
                                ? "Your booking for " + activityTitle + " was cancelled by the guide. No refund was issued."
                                : "Your booking for " + activityTitle + " was cancelled. This booking is not refundable under the cancellation policy.",
                        NotificationSeverity.WARNING,
                        "/my-bookings",
                        "BOOKING",
                        booking.getId()
                );

                return;
            }

            if (refundStatus == RefundStatus.REFUND_FAILED) {
                notificationService.createAndSendIfAbsent(
                        booking.getUserId(),
                        NotificationType.REFUND_REJECTED,
                        "Refund failed",
                        guideCancelled
                                ? "Your booking for " + activityTitle + " was cancelled by the guide, but the refund could not be processed. Please contact support."
                                : "Your booking for " + activityTitle + " was cancelled, but the refund could not be processed. Please contact support.",
                        NotificationSeverity.ERROR,
                        "/my-bookings",
                        "BOOKING",
                        booking.getId()
                );

                return;
            }

            if (refundStatus == RefundStatus.NONE) {
                notificationService.createAndSendIfAbsent(
                        booking.getUserId(),
                        NotificationType.SESSION_CANCELLED,
                        guideCancelled ? "Booking cancelled by guide" : "Booking cancelled",
                        guideCancelled
                                ? "Your booking for " + activityTitle + " was cancelled by the guide."
                                : "Your booking for " + activityTitle + " was cancelled.",
                        NotificationSeverity.INFO,
                        "/my-bookings",
                        "BOOKING",
                        booking.getId()
                );
            }
        } catch (RuntimeException e) {
            System.out.println("Failed to create refund/cancellation notification for booking "
                    + booking.getId() + ": " + e.getMessage());
        }
    }

    private String buildRefundApprovedMessage(
            Booking booking,
            String activityTitle,
            boolean partial,
            boolean guideCancelled
    ) {
        String amountText = formatRefundAmount(booking);

        String cancellationText = guideCancelled
                ? "Your booking for " + activityTitle + " was cancelled by the guide."
                : "Your booking for " + activityTitle + " was cancelled.";

        if (partial) {
            return amountText == null
                    ? cancellationText + " A partial refund was approved."
                    : cancellationText + " A partial refund of " + amountText + " was approved.";
        }

        return amountText == null
                ? cancellationText + " A refund was approved."
                : cancellationText + " A refund of " + amountText + " was approved.";
    }

    private String formatRefundAmount(Booking booking) {
        if (booking.getRefundAmount() <= 0) {
            return null;
        }

        return formatMinorAmount(booking.getRefundAmount(), booking.getRefundCurrency());
    }

    private String formatMinorAmount(int amountMinor, String currency) {
        if (amountMinor <= 0) {
            return null;
        }

        // Stripe stores amounts in minor units; UnTamed displays booking prices in TND.
        double amountMajor = amountMinor / 100.0;
        return String.format(Locale.US, "%s %.2f", displayCurrency(currency), amountMajor);
    }

    private String displayCurrency(String currency) {
        return "TND";
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
        levelingService.recalculateUserLevel(savedBooking.getUserId());

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

    private void notifyBookingConfirmedIfFirstTransition(Booking booking, BookingStatus oldStatus) {
        if (oldStatus == BookingStatus.COMPLETED || booking.getStatus() != BookingStatus.COMPLETED) {
            return;
        }

        try {
            BookingNotificationContext context = buildBookingNotificationContext(booking);
            String activityTitle = context.activityTitle();
            String userId = booking.getUserId();

            if (!isBlank(userId)) {
                notificationService.createAndSend(
                        userId,
                        NotificationType.BOOKING_CONFIRMED,
                        "Booking confirmed",
                        "Your booking for " + activityTitle + " is confirmed.",
                        NotificationSeverity.SUCCESS,
                        "/my-bookings",
                        "BOOKING",
                        booking.getId()
                );
            }

            if (!isBlank(context.guideId())) {
                notificationService.createAndSend(
                        context.guideId(),
                        NotificationType.BOOKING_CREATED,
                        "New booking received",
                        context.username() + " booked " + booking.getNumberOfPeople()
                                + " spot(s) for " + activityTitle + ".",
                        NotificationSeverity.SUCCESS,
                        !isBlank(context.templateId())
                                ? "/guide/templates/" + context.templateId() + "/sessions"
                                : "/guide",
                        "BOOKING",
                        booking.getId()
                );
            }
        } catch (RuntimeException e) {
            System.out.println("Failed to create booking confirmation notifications for booking "
                    + booking.getId() + ": " + e.getMessage());
        }
    }

    private void syncChatRoomParticipants(String sessionId) {
        try {
            chatService.refreshRoomParticipantsForSession(sessionId);
        } catch (RuntimeException e) {
            System.out.println("Failed to refresh chat participants for session "
                    + sessionId + ": " + e.getMessage());
        }
    }

    private void createChatSystemMessage(String sessionId, String message) {
        try {
            chatService.createSystemMessageForSession(sessionId, message);
        } catch (RuntimeException e) {
            System.out.println("Failed to create chat system message for session "
                    + sessionId + ": " + e.getMessage());
        }
    }

    private void sendChatRemovalEvent(Booking booking) {
        if (booking == null || isBlank(booking.getUserId())) {
            return;
        }

        try {
            chatService.sendUserRemovedFromSessionChat(
                    booking.getSessionId(),
                    booking.getUserId(),
                    "You no longer have access to this chat because your booking was cancelled."
            );
        } catch (RuntimeException e) {
            System.out.println("Failed to send chat removal event for booking "
                    + booking.getId() + ": " + e.getMessage());
        }
    }

    private String usernameForSystemMessage(Booking booking) {
        if (booking == null || isBlank(booking.getUserId())) {
            return "A traveler";
        }

        return userRepository.findById(booking.getUserId())
                .map(User::getUsername)
                .filter(username -> !isBlank(username))
                .orElse("A traveler");
    }

    private BookingNotificationContext buildBookingNotificationContext(Booking booking) {
        ActivitySession session = activitySessionRepository.findById(booking.getSessionId()).orElse(null);
        ActivityTemplate template = null;

        if (session != null && !isBlank(session.getTemplateId())) {
            template = activityTemplateRepository.findById(session.getTemplateId()).orElse(null);
        }

        User bookingUser = isBlank(booking.getUserId())
                ? null
                : userRepository.findById(booking.getUserId()).orElse(null);

        String activityTitle = template != null && !isBlank(template.getTitle())
                ? template.getTitle()
                : "this activity";
        String templateId = template != null ? template.getId() : session != null ? session.getTemplateId() : null;
        String guideId = session != null && !isBlank(session.getGuideId())
                ? session.getGuideId()
                : template != null ? template.getGuideId() : null;
        String username = bookingUser != null && !isBlank(bookingUser.getUsername())
                ? bookingUser.getUsername()
                : "A traveler";

        return new BookingNotificationContext(activityTitle, templateId, guideId, username);
    }

    private boolean isBlank(String value) {
        return value == null || value.trim().isEmpty();
    }

    private record BookingNotificationContext(
            String activityTitle,
            String templateId,
            String guideId,
            String username
    ) {}

    public ParticipantsPreviewResponse getParticipantsPreview(String sessionId) {
        ActivitySession session = activitySessionRepository.findById(sessionId)
                .orElseThrow(() -> new IllegalArgumentException("Session not found"));

        List<Booking> confirmedBookings =
                bookingRepository.findBySessionIdAndStatus(sessionId, BookingStatus.COMPLETED);

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

    public List<BookingWithDetailsDto> listMineWithDetails(String userId) {
        List<Booking> bookings = bookingRepository.findByUserIdOrderByCreatedAtDesc(userId);

        Map<String, ActivitySession> sessionsById = activitySessionRepository
                .findAllById(bookings.stream().map(Booking::getSessionId).collect(Collectors.toSet()))
                .stream()
                .collect(Collectors.toMap(ActivitySession::getId, Function.identity()));

        Set<String> templateIds = sessionsById.values()
                .stream()
                .map(ActivitySession::getTemplateId)
                .filter(Objects::nonNull)
                .collect(Collectors.toSet());

        Map<String, ActivityTemplate> templatesById = activityTemplateRepository
                .findAllById(templateIds)
                .stream()
                .collect(Collectors.toMap(ActivityTemplate::getId, Function.identity()));

        Set<String> addressIds = templatesById.values()
                .stream()
                .map(ActivityTemplate::getAddressId)
                .filter(Objects::nonNull)
                .collect(Collectors.toSet());

        Map<String, Address> addressesById = addressRepository
                .findAllById(addressIds)
                .stream()
                .collect(Collectors.toMap(Address::getId, Function.identity()));

        List<String> completedBookingIds = bookings.stream()
                .filter(booking -> booking.getStatus() == BookingStatus.COMPLETED)
                .map(Booking::getId)
                .toList();

        List<Review> existingReviews = completedBookingIds.isEmpty()
                ? List.of()
                : reviewRepository.findByReviewerIdAndBookingIdIn(userId, completedBookingIds);

        if (!templateIds.isEmpty()) {
            existingReviews = new java.util.ArrayList<>(existingReviews);
            existingReviews.addAll(reviewRepository.findByReviewerIdAndActivityTemplateIdIn(userId, List.copyOf(templateIds)));
        }

        Map<String, Review> reviewsByTemplateId = existingReviews.isEmpty()
                ? Map.of()
                : existingReviews.stream()
                .collect(Collectors.toMap(
                        Review::getActivityTemplateId,
                        Function.identity(),
                        (first, ignored) -> first
                ));

        Instant now = Instant.now();

        return bookings.stream().map(b -> {
            String activityTitle = null;
            String activityTemplateId = null;
            String guideId = null;
            String activityImageUrl = null;
            Instant sessionStartAt = null;
            String meetingPoint = null;
            MeetingPointDto meetingPointLocation = null;
            List<String> activityTags = List.of();
            List<String> categoryIds = List.of();
            String displayName = null;
            String governorate = null;
            String locality = null;
            Double latitude = null;
            Double longitude = null;
            BigDecimal pricePerPerson = null;
            BigDecimal totalPrice = null;
            boolean reviewEligible = false;
            boolean alreadyReviewed = false;
            String reviewId = null;
            String reviewReason = null;

            ActivitySession session = sessionsById.get(b.getSessionId());

            if (session != null) {
                sessionStartAt = session.getStartAt();
                meetingPoint = session.getMeetingPoint();
                meetingPointLocation = toMeetingPointDto(session.getMeetingPointLocation());
                activityTemplateId = session.getTemplateId();

                ActivityTemplate template = templatesById.get(activityTemplateId);

                if (template != null) {
                    guideId = template.getGuideId();
                    activityTitle = template.getTitle();
                    activityTags = template.getTags() == null ? List.of() : template.getTags();
                    categoryIds = template.getCategoryIds() == null ? List.of() : template.getCategoryIds();

                    pricePerPerson = template.getPrice();
                    totalPrice = pricePerPerson != null
                            ? pricePerPerson.multiply(BigDecimal.valueOf(b.getNumberOfPeople()))
                            : null;

                    if (template.getImages() != null && !template.getImages().isEmpty()) {
                        activityImageUrl = template.getImages().stream()
                                .filter(img -> Boolean.TRUE.equals(img.isCover()))
                                .findFirst()
                                .or(() -> template.getImages().stream().findFirst())
                                .map(img -> img.getUrl())
                                .orElse(null);
                    }

                    if (template.getAddressId() != null) {
                        Address address = addressesById.get(template.getAddressId());

                        if (address != null) {
                            displayName = address.getDisplayName();
                            governorate = address.getGovernorate();
                            locality = address.getLocality();
                            latitude = address.getLatitude();
                            longitude = address.getLongitude();
                        }
                    }

                    ReviewEligibilitySnapshot eligibility = reviewEligibilityForDetails(
                            b,
                            session,
                            template,
                            reviewsByTemplateId.get(template.getId()),
                            userId,
                            now
                    );
                    reviewEligible = eligibility.reviewEligible();
                    alreadyReviewed = eligibility.alreadyReviewed();
                    reviewId = eligibility.reviewId();
                    reviewReason = eligibility.reviewReason();
                }
            } else if (b.getStatus() == BookingStatus.COMPLETED) {
                reviewReason = "Session not found.";
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
                    activityTemplateId,
                    guideId,
                    activityTitle,
                    activityImageUrl,
                    sessionStartAt,
                    meetingPoint,
                    meetingPointLocation,
                    activityTags,
                    categoryIds,
                    displayName,
                    governorate,
                    locality,
                    latitude,
                    longitude,
                    pricePerPerson,
                    totalPrice,
                    reviewEligible,
                    alreadyReviewed,
                    reviewId,
                    reviewReason
            );
        }).toList();
    }

    private MeetingPointDto toMeetingPointDto(MeetingPoint meetingPoint) {
        if (meetingPoint == null) {
            return null;
        }

        return new MeetingPointDto(
                meetingPoint.getLabel(),
                meetingPoint.getAddress(),
                meetingPoint.getLatitude(),
                meetingPoint.getLongitude(),
                meetingPoint.getPlaceId(),
                meetingPoint.getSource()
        );
    }

    private ReviewEligibilitySnapshot reviewEligibilityForDetails(
            Booking booking,
            ActivitySession session,
            ActivityTemplate template,
            Review existingReview,
            String userId,
            Instant now
    ) {
        if (template.getGuideId() != null && template.getGuideId().equals(userId)) {
            return new ReviewEligibilitySnapshot(false, false, null, "Guide cannot review their own activity.");
        }

        if (booking.getStatus() != BookingStatus.COMPLETED) {
            return new ReviewEligibilitySnapshot(false, false, null, null);
        }

        if (booking.isAttendanceMarkedAbsent()) {
            return new ReviewEligibilitySnapshot(false, false, null, "Absent participants cannot leave reviews.");
        }

        if (session.getStartAt() == null || !session.getStartAt().isBefore(now)) {
            return new ReviewEligibilitySnapshot(false, false, null, "You can review only after the session date has passed.");
        }

        if (existingReview != null) {
            return new ReviewEligibilitySnapshot(false, true, existingReview.getId(), "You already reviewed this activity.");
        }

        return new ReviewEligibilitySnapshot(true, false, null, "Eligible to review.");
    }

    private record ReviewEligibilitySnapshot(
            boolean reviewEligible,
            boolean alreadyReviewed,
            String reviewId,
            String reviewReason
    ) {}

    public RefundPreviewResponse previewCancelBooking(String bookingId, String userId) {
        Booking b = bookingRepository.findById(bookingId)
                .orElseThrow(() -> notFound(BookingErrors.BOOKING_NOT_FOUND));

        assertOwned(b, userId);

        if (b.getStatus() == BookingStatus.CANCELLED || b.getStatus() == BookingStatus.EXPIRED) {
            throw conflict(BookingErrors.BOOKING_NOT_ACTIVE);
        }

        if (b.getStatus() == BookingStatus.PAYING) {
            throw conflict("Payment in progress. Verify payment status first.");
        }

        ActivitySession session = sessionSeatOps.getSessionOrThrow(b.getSessionId());
        PaymentAttempt attempt = findSucceededStripeAttemptOrNull(b.getId());

        return refundPolicyService.previewUserCancellation(b, session, attempt);
    }

    private PaymentAttempt findSucceededStripeAttemptOrNull(String bookingId) {
        return paymentAttemptRepository
                .findFirstByBookingIdAndProviderOrderByCreatedAtDesc(bookingId, PaymentProvider.STRIPE)
                .filter(a -> a.getStatus() == PaymentAttemptStatus.SUCCEEDED)
                .orElse(null);
    }

    private void recordRevenueForPaidBooking(String bookingId) {
        try {
            revenueService.recordPaidBookingIfAbsent(bookingId);
        } catch (RuntimeException e) {
            System.out.println("Failed to record revenue for booking " + bookingId + ": " + e.getMessage());
        }
    }

    private void adjustRevenueAfterRefund(Booking booking) {
        if (booking == null) {
            return;
        }

        RefundStatus status = booking.getRefundStatus();
        if (status != RefundStatus.REFUNDED && status != RefundStatus.PARTIALLY_REFUNDED) {
            return;
        }

        try {
            revenueService.applyRefundAdjustment(booking.getId(), booking.getRefundAmount());
        } catch (RuntimeException e) {
            System.out.println("Failed to adjust revenue after refund for booking "
                    + booking.getId() + ": " + e.getMessage());
            throw e;
        }
    }

    private void cancelGuestPasses(String bookingId) {
        List<GuestPass> passes = guestPassRepository.findByBookingId(bookingId);

        if (passes.isEmpty()) {
            return;
        }

        passes.forEach(GuestPass::cancel);
        guestPassRepository.saveAll(passes);
    }

    private void applyCancellationMetadata(
            Booking booking,
            CancelledBy cancelledBy,
            String reason,
            RefundPreviewResponse preview,
            String stripeRefundId
    ) {
        Instant now = Instant.now();

        booking.setStatus(BookingStatus.CANCELLED);
        booking.setNumberOfPeople(0);
        booking.setExpiresAt(null);
        booking.setUpdatedAt(now);
        booking.setCancelledAt(now);
        booking.setCancelledBy(cancelledBy);
        booking.setCancellationReason(reason);

        booking.setRefundStatus(preview.refundStatus());
        booking.setRefundPercent(preview.refundPercent());
        booking.setRefundAmount(preview.refundAmount());
        booking.setRefundCurrency(preview.currency());
        booking.setStripeRefundId(stripeRefundId);
    }
}

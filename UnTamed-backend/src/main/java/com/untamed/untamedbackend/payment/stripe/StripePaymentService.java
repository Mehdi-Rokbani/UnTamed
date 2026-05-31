package com.untamed.untamedbackend.payment.stripe;

import com.stripe.exception.StripeException;
import com.stripe.model.StripeError;
import com.stripe.model.PaymentIntent;
import com.stripe.model.checkout.Session;
import com.stripe.net.RequestOptions;
import com.stripe.param.PaymentIntentCreateParams;
import com.stripe.param.checkout.SessionCreateParams;
import com.untamed.untamedbackend.booking.Booking;
import com.untamed.untamedbackend.booking.BookingService;
import com.untamed.untamedbackend.model.ActivitySession;
import com.untamed.untamedbackend.model.ActivityTemplate;
import com.untamed.untamedbackend.payment.PaymentAttempt;
import com.untamed.untamedbackend.payment.PaymentAttemptRepository;
import com.untamed.untamedbackend.payment.PaymentAttemptStatus;
import com.untamed.untamedbackend.payment.PaymentProvider;
import com.untamed.untamedbackend.repository.ActivitySessionRepository;
import com.untamed.untamedbackend.repository.ActivityTemplateRepository;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;
import com.stripe.model.Refund;
import com.stripe.param.RefundCreateParams;
import com.stripe.param.checkout.SessionRetrieveParams;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.time.Duration;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class StripePaymentService {

    private static final Logger log = LoggerFactory.getLogger(StripePaymentService.class);
    private static final Duration PAYMENT_ATTEMPT_STARTUP_GRACE = Duration.ofMinutes(2);

    private final StripeProperties stripeProps;
    private final PaymentAttemptRepository attempts;
    private final BookingService bookingService;
    private final ActivitySessionRepository activitySessionRepository;
    private final ActivityTemplateRepository activityTemplateRepository;
    private final Map<String, Object> paymentIntentLocks = new ConcurrentHashMap<>();

    public StripeCreatePaymentResponse create(String userId, String bookingId) {
        Booking booking = bookingService.markPaying(bookingId, userId);

        PaymentAttempt attempt = null;

        try {
            ensureStripeConfigured();

            long amount = computeAmountInCents(booking);
            String currency = stripeCurrency();

            String idempotencyKey = "stripe:" + bookingId + ":" + UUID.randomUUID();

            attempt = PaymentAttempt.builder()
                    .bookingId(bookingId)
                    .userId(userId)
                    .provider(PaymentProvider.STRIPE)
                    .status(PaymentAttemptStatus.CREATED)
                    .amount((int) amount)
                    .currency(currency.toUpperCase())
                    .idempotencyKey(idempotencyKey)
                    .createdAt(Instant.now())
                    .updatedAt(Instant.now())
                    .build();

            attempt = attempts.save(attempt);

            SessionCreateParams params = SessionCreateParams.builder()
                    .setMode(SessionCreateParams.Mode.PAYMENT)
                    .setSuccessUrl(stripeProps.getSuccessUrl())
                    .setCancelUrl(stripeProps.getCancelUrl() + "?bookingId=" + bookingId)
                    .putMetadata("bookingId", bookingId)
                    .putMetadata("userId", userId)
                    .putMetadata("attemptId", attempt.getId())
                    .addLineItem(
                            SessionCreateParams.LineItem.builder()
                                    .setQuantity(1L)
                                    .setPriceData(
                                            SessionCreateParams.LineItem.PriceData.builder()
                                                    .setCurrency(currency)
                                                    .setUnitAmount(amount)
                                                    .setProductData(
                                                            SessionCreateParams.LineItem.PriceData.ProductData.builder()
                                                                    .setName("Untamed booking")
                                                                    .setDescription("Booking payment: " + bookingId)
                                                                    .build()
                                                    )
                                                    .build()
                                    )
                                    .build()
                    )
                    .build();

            Session session = Session.create(params);

            attempt.setProviderRef(session.getId());
            attempt.setStatus(PaymentAttemptStatus.PENDING);
            attempt.setUpdatedAt(Instant.now());
            attempts.save(attempt);

            return new StripeCreatePaymentResponse(session.getUrl(), session.getId());

        } catch (StripeException e) {
            if (attempt != null) {
                attempt.setStatus(PaymentAttemptStatus.FAILED);
                attempt.setUpdatedAt(Instant.now());
                attempts.save(attempt);
            }

            bookingService.handlePaymentFailed(bookingId);
            logStripeException("checkout session", bookingId, attempt, e);

            throw new ResponseStatusException(
                    HttpStatus.BAD_GATEWAY,
                    "Stripe payment creation failed. Please try again later."
            );

        } catch (RuntimeException e) {
            bookingService.handlePaymentFailed(bookingId);
            throw e;
        }
    }

    public StripeElementsPaymentResponse createElementsPayment(String userId, String bookingId) {
        Object lock = paymentIntentLocks.computeIfAbsent(bookingId, key -> new Object());
        synchronized (lock) {
            return createElementsPaymentLocked(userId, bookingId);
        }
    }

    private StripeElementsPaymentResponse createElementsPaymentLocked(String userId, String bookingId) {
        Booking booking = bookingService.markPaying(bookingId, userId);
        ensureStripeConfigured();

        PaymentAttempt reusable = findReusablePaymentIntentAttempt(bookingId);
        if (reusable != null) {
            StripeElementsPaymentResponse reusableResponse = tryReusePaymentIntent(booking, reusable);
            if (reusableResponse != null) {
                return reusableResponse;
            }
        }

        long amount = computeAmountInCents(booking);
        String currency = stripeCurrency();
        String idempotencyKey = "stripe-elements:" + bookingId + ":" + UUID.randomUUID();

        PaymentAttempt attempt = PaymentAttempt.builder()
                .bookingId(bookingId)
                .userId(userId)
                .provider(PaymentProvider.STRIPE)
                .status(PaymentAttemptStatus.CREATED)
                .amount((int) amount)
                .currency(currency.toUpperCase())
                .idempotencyKey(idempotencyKey)
                .createdAt(Instant.now())
                .updatedAt(Instant.now())
                .build();

        attempt = attempts.save(attempt);

        try {
            PaymentIntentCreateParams params = PaymentIntentCreateParams.builder()
                    .setAmount(amount)
                    .setCurrency(currency)
                    .setAutomaticPaymentMethods(
                            PaymentIntentCreateParams.AutomaticPaymentMethods.builder()
                                    .setEnabled(true)
                                    .build()
                    )
                    .putMetadata("bookingId", bookingId)
                    .putMetadata("userId", userId)
                    .putMetadata("attemptId", attempt.getId())
                    .build();

            RequestOptions requestOptions = stripeRequestOptions(idempotencyKey);

            log.info("Creating Stripe PaymentIntent for bookingId={}, attemptId={}, amount={}, currency={}",
                    bookingId, attempt.getId(), amount, currency.toUpperCase());
            PaymentIntent intent = PaymentIntent.create(params, requestOptions);
            log.info("Created Stripe PaymentIntent for bookingId={}, attemptId={}, paymentIntentId={}, stripeStatus={}",
                    bookingId, attempt.getId(), intent.getId(), intent.getStatus());

            attempt.setProviderRef(intent.getId());
            attempt.setStatus(PaymentAttemptStatus.PENDING);
            attempt.setUpdatedAt(Instant.now());
            attempts.save(attempt);

            return new StripeElementsPaymentResponse(
                    intent.getClientSecret(),
                    booking.getId(),
                    attempt.getAmount(),
                    attempt.getCurrency(),
                    booking.getExpiresAt(),
                    attempt.getId(),
                    attempt.getProviderRef()
            );
        } catch (StripeException e) {
            attempt.setStatus(PaymentAttemptStatus.FAILED);
            attempt.setUpdatedAt(Instant.now());
            attempts.save(attempt);

            bookingService.handlePaymentFailed(bookingId);
            logStripeException("payment intent creation", bookingId, attempt, e);

            throw new ResponseStatusException(
                    HttpStatus.BAD_GATEWAY,
                    stripePaymentErrorMessage(e)
            );
        } catch (RuntimeException e) {
            attempt.setStatus(PaymentAttemptStatus.FAILED);
            attempt.setUpdatedAt(Instant.now());
            attempts.save(attempt);

            bookingService.handlePaymentFailed(bookingId);
            log.error("Stripe payment intent creation failed unexpectedly for bookingId={}, attemptId={}",
                    bookingId, attempt.getId(), e);
            throw e;
        }
    }

    private StripeElementsPaymentResponse tryReusePaymentIntent(Booking booking, PaymentAttempt reusable) {
        String bookingId = booking.getId();

        if (reusable.getProviderRef() == null || reusable.getProviderRef().isBlank()) {
            if (isFreshStartupAttempt(reusable)) {
                log.info("Stripe PaymentIntent creation already in progress for bookingId={}, attemptId={}",
                        bookingId, reusable.getId());
                throw new ResponseStatusException(
                        HttpStatus.CONFLICT,
                        "Payment initialization is already in progress. Please try again in a few seconds."
                );
            }

            reusable.setStatus(PaymentAttemptStatus.FAILED);
            reusable.setUpdatedAt(Instant.now());
            attempts.save(reusable);
            log.warn("Marked stale Stripe payment attempt failed for bookingId={}, attemptId={}",
                    bookingId, reusable.getId());
            return null;
        }

        try {
            log.info("Retrieving reusable Stripe PaymentIntent for bookingId={}, attemptId={}, paymentIntentId={}",
                    bookingId, reusable.getId(), reusable.getProviderRef());
            PaymentIntent intent = PaymentIntent.retrieve(reusable.getProviderRef(), stripeRequestOptions(null));
            log.info("Retrieved reusable Stripe PaymentIntent for bookingId={}, attemptId={}, paymentIntentId={}, stripeStatus={}",
                    bookingId, reusable.getId(), reusable.getProviderRef(), intent.getStatus());

            if (intent.getClientSecret() != null && isReusablePaymentIntentStatus(intent.getStatus())) {
                return new StripeElementsPaymentResponse(
                        intent.getClientSecret(),
                        booking.getId(),
                        reusable.getAmount(),
                        reusable.getCurrency(),
                        booking.getExpiresAt(),
                        reusable.getId(),
                        reusable.getProviderRef()
                );
            }

            reusable.setStatus(PaymentAttemptStatus.FAILED);
            reusable.setUpdatedAt(Instant.now());
            attempts.save(reusable);
            log.info("Reusable Stripe PaymentIntent is no longer active; marked attempt failed for bookingId={}, attemptId={}, stripeStatus={}",
                    bookingId, reusable.getId(), intent.getStatus());
        } catch (StripeException e) {
            reusable.setStatus(PaymentAttemptStatus.FAILED);
            reusable.setUpdatedAt(Instant.now());
            attempts.save(reusable);
            logStripeException("reusable payment intent retrieval", bookingId, reusable, e);
        } catch (RuntimeException e) {
            reusable.setStatus(PaymentAttemptStatus.FAILED);
            reusable.setUpdatedAt(Instant.now());
            attempts.save(reusable);
            log.error("Reusable Stripe PaymentIntent retrieval failed unexpectedly for bookingId={}, attemptId={}, paymentIntentId={}",
                    bookingId, reusable.getId(), reusable.getProviderRef(), e);
            throw e;
        }

        return null;
    }

    public void cancelPayment(String userId, String bookingId) {
        bookingService.handlePaymentFailed(bookingId, userId);
    }

    private PaymentAttempt findReusablePaymentIntentAttempt(String bookingId) {
        return attempts.findFirstByBookingIdAndProviderAndStatusInOrderByCreatedAtDesc(
                        bookingId,
                        PaymentProvider.STRIPE,
                        List.of(PaymentAttemptStatus.PENDING, PaymentAttemptStatus.CREATED)
                )
                .filter(attempt -> attempt.getProviderRef() == null || attempt.getProviderRef().startsWith("pi_"))
                .orElse(null);
    }

    private RequestOptions stripeRequestOptions(String idempotencyKey) {
        RequestOptions.RequestOptionsBuilder builder = RequestOptions.builder()
                .setConnectTimeout(connectTimeoutMs())
                .setReadTimeout(readTimeoutMs());

        if (idempotencyKey != null && !idempotencyKey.isBlank()) {
            builder.setIdempotencyKey(idempotencyKey);
        }

        return builder.build();
    }

    private int connectTimeoutMs() {
        Integer configured = stripeProps.getConnectTimeoutMs();
        return configured == null || configured <= 0 ? 5000 : configured;
    }

    private int readTimeoutMs() {
        Integer configured = stripeProps.getReadTimeoutMs();
        return configured == null || configured <= 0 ? 15000 : configured;
    }

    private boolean isFreshStartupAttempt(PaymentAttempt attempt) {
        Instant createdAt = attempt.getCreatedAt();
        return createdAt != null && createdAt.plus(PAYMENT_ATTEMPT_STARTUP_GRACE).isAfter(Instant.now());
    }

    private void ensureStripeConfigured() {
        if (stripeProps.getSecretKey() == null || stripeProps.getSecretKey().isBlank()) {
            log.error("Stripe payment creation blocked: stripe.secret-key is missing.");
            throw new ResponseStatusException(
                    HttpStatus.SERVICE_UNAVAILABLE,
                    "Stripe is not configured. Please contact support."
            );
        }
    }

    private String stripeCurrency() {
        String configured = stripeProps.getCurrency();
        if (configured == null || configured.isBlank()) {
            return "eur";
        }

        return configured.trim().toLowerCase(Locale.ROOT);
    }

    private String stripePaymentErrorMessage(StripeException e) {
        StripeError stripeError = e.getStripeError();
        if (stripeError != null && "currency".equals(stripeError.getParam())) {
            return "Payment currency is not supported by the current Stripe account configuration.";
        }

        return "Stripe payment intent creation failed. Please try again later.";
    }

    private void logStripeException(String operation, String bookingId, PaymentAttempt attempt, StripeException e) {
        StripeError stripeError = e.getStripeError();
        String code = stripeError == null ? e.getCode() : stripeError.getCode();
        String declineCode = stripeError == null ? null : stripeError.getDeclineCode();
        String param = stripeError == null ? null : stripeError.getParam();

        log.error(
                "Stripe {} failed for bookingId={}, attemptId={}, providerRef={}, statusCode={}, requestId={}, code={}, declineCode={}, param={}, message={}",
                operation,
                bookingId,
                attempt == null ? null : attempt.getId(),
                attempt == null ? null : attempt.getProviderRef(),
                e.getStatusCode(),
                e.getRequestId(),
                code,
                declineCode,
                param,
                e.getMessage()
        );
    }

    private boolean isReusablePaymentIntentStatus(String status) {
        return "requires_payment_method".equals(status)
                || "requires_confirmation".equals(status)
                || "requires_action".equals(status)
                || "processing".equals(status);
    }

    private long computeAmountInCents(Booking booking) {
        ActivitySession session = activitySessionRepository.findById(booking.getSessionId())
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND,
                        "Activity session not found"
                ));

        ActivityTemplate template = activityTemplateRepository.findById(session.getTemplateId())
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND,
                        "Activity template not found"
                ));

        BigDecimal price = template.getPrice();

        if (price == null || price.compareTo(BigDecimal.ZERO) <= 0) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Activity price must be greater than 0"
            );
        }

        int people = Math.max(1, booking.getNumberOfPeople());

        return price
                .multiply(BigDecimal.valueOf(people))
                .multiply(BigDecimal.valueOf(100))
                .setScale(0, RoundingMode.HALF_UP)
                .longValueExact();
    }

    public String refundPaymentAttempt(PaymentAttempt attempt, int amount, String reason) {
        if (attempt == null) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Payment attempt not found.");
        }

        if (attempt.getStatus() != PaymentAttemptStatus.SUCCEEDED) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Only succeeded payments can be refunded.");
        }

        if (attempt.getProviderRef() == null || attempt.getProviderRef().isBlank()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Stripe checkout session reference is missing.");
        }

        if (amount <= 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Refund amount must be greater than 0.");
        }

        try {
            SessionRetrieveParams retrieveParams = SessionRetrieveParams.builder()
                    .addExpand("payment_intent")
                    .build();

            Session checkoutSession = Session.retrieve(attempt.getProviderRef(), retrieveParams, null);

            String paymentIntentId = checkoutSession.getPaymentIntent();

            if (paymentIntentId == null || paymentIntentId.isBlank()) {
                throw new ResponseStatusException(HttpStatus.CONFLICT, "Stripe payment intent is missing.");
            }

            RefundCreateParams params = RefundCreateParams.builder()
                    .setPaymentIntent(paymentIntentId)
                    .setAmount((long) amount)
                    .putMetadata("bookingId", attempt.getBookingId())
                    .putMetadata("paymentAttemptId", attempt.getId())
                    .putMetadata("reason", reason == null ? "" : reason)
                    .build();

            Refund refund = Refund.create(params);

            return refund.getId();

        } catch (StripeException e) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_GATEWAY,
                    "Stripe refund failed"
            );
        }
    }
}

package com.untamed.untamedbackend.payment.stripe;

import com.stripe.exception.StripeException;
import com.stripe.model.checkout.Session;
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
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;
import com.stripe.model.Refund;
import com.stripe.param.RefundCreateParams;
import com.stripe.param.checkout.SessionRetrieveParams;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class StripePaymentService {

    private final StripeProperties stripeProps;
    private final PaymentAttemptRepository attempts;
    private final BookingService bookingService;
    private final ActivitySessionRepository activitySessionRepository;
    private final ActivityTemplateRepository activityTemplateRepository;

    public StripeCreatePaymentResponse create(String userId, String bookingId) {
        Booking booking = bookingService.markPaying(bookingId, userId);

        PaymentAttempt attempt = null;

        try {
            long amount = computeAmountInCents(booking);
            String currency = "usd";

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

            throw new ResponseStatusException(
                    HttpStatus.BAD_GATEWAY,
                    "Stripe payment creation failed"
            );

        } catch (RuntimeException e) {
            bookingService.handlePaymentFailed(bookingId);
            throw e;
        }
    }

    public void cancelPayment(String userId, String bookingId) {
        bookingService.handlePaymentFailed(bookingId, userId);
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
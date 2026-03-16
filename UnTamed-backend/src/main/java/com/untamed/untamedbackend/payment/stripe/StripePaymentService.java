package com.untamed.untamedbackend.payment.stripe;

import com.stripe.exception.StripeException;
import com.stripe.model.checkout.Session;
import com.stripe.param.checkout.SessionCreateParams;
import com.untamed.untamedbackend.booking.Booking;
import com.untamed.untamedbackend.booking.BookingService;
import com.untamed.untamedbackend.payment.PaymentAttempt;
import com.untamed.untamedbackend.payment.PaymentAttemptRepository;
import com.untamed.untamedbackend.payment.PaymentAttemptStatus;
import com.untamed.untamedbackend.payment.PaymentProvider;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;
import com.stripe.Stripe;

import java.time.Instant;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class StripePaymentService {

    private final StripeProperties stripeProps;
    private final PaymentAttemptRepository attempts;
    private final BookingService bookingService;

    public StripeCreatePaymentResponse create(String userId, String bookingId) {
        Stripe.apiKey = stripeProps.getSecretKey();
        Booking booking = bookingService.markPaying(bookingId, userId);

        int amount = computeAmount(booking);
        String currency = "USD";

        String idempotencyKey = "stripe:" + bookingId + ":" + UUID.randomUUID();

        PaymentAttempt attempt = PaymentAttempt.builder()
                .bookingId(bookingId)
                .userId(userId)
                .provider(PaymentProvider.STRIPE)
                .status(PaymentAttemptStatus.CREATED)
                .amount(amount)
                .currency(currency)
                .idempotencyKey(idempotencyKey)
                .createdAt(Instant.now())
                .updatedAt(Instant.now())
                .build();

        attempt = attempts.save(attempt);

        try {
            SessionCreateParams params = SessionCreateParams.builder()
                    .setMode(SessionCreateParams.Mode.PAYMENT)
                    .setSuccessUrl(stripeProps.getSuccessUrl() + "?session_id={CHECKOUT_SESSION_ID}")
                    .setCancelUrl(stripeProps.getCancelUrl())
                    .putMetadata("bookingId", bookingId)
                    .putMetadata("userId", userId)
                    .putMetadata("attemptId", attempt.getId())
                    .addLineItem(
                            SessionCreateParams.LineItem.builder()
                                    .setQuantity(1L)
                                    .setPriceData(
                                            SessionCreateParams.LineItem.PriceData.builder()
                                                    .setCurrency(currency)
                                                    .setUnitAmount((long) amount)
                                                    .setProductData(
                                                            SessionCreateParams.LineItem.PriceData.ProductData.builder()
                                                                    .setName("Booking payment")
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
            e.printStackTrace();
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, e.getMessage());
        }
    }

    private int computeAmount(Booking booking) {
        return Math.max(1, booking.getNumberOfPeople()) * 10_000;
    }
}
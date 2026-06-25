package com.untamed.untamedbackend.payment.stripe;

import com.stripe.exception.SignatureVerificationException;
import com.stripe.model.Event;
import com.stripe.model.PaymentIntent;
import com.stripe.model.checkout.Session;
import com.stripe.net.Webhook;
import com.untamed.untamedbackend.booking.BookingService;
import com.untamed.untamedbackend.guestpass.GuestPassService;
import com.untamed.untamedbackend.payment.PaymentAttempt;
import com.untamed.untamedbackend.payment.PaymentAttemptRepository;
import com.untamed.untamedbackend.payment.PaymentAttemptStatus;
import com.untamed.untamedbackend.payment.PaymentProvider;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@RestController
@RequestMapping("/api/payments")
@RequiredArgsConstructor
public class StripeWebhookController {

    private static final Logger log = LoggerFactory.getLogger(StripeWebhookController.class);

    private final StripeProperties stripeProps;
    private final PaymentAttemptRepository attempts;
    private final BookingService bookingService;
    private final GuestPassService guestPassService;

    @PostMapping({"/webhook", "/stripe/webhook"})
    public ResponseEntity<String> webhook(
            @RequestBody String payload,
            @RequestHeader("Stripe-Signature") String sigHeader
    ) {
        Event event;

        if (stripeProps.getWebhookSecret() == null || stripeProps.getWebhookSecret().isBlank()) {
            log.error("Stripe webhook blocked: stripe.webhook-secret missing");
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                    .body("Stripe webhook is not configured");
        }

        try {
            event = Webhook.constructEvent(
                    payload,
                    sigHeader,
                    stripeProps.getWebhookSecret()
            );
        } catch (SignatureVerificationException e) {
            log.warn("Stripe webhook signature verification failed");
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body("Invalid signature");
        }

        log.info("Stripe webhook received: eventId={}, type={}", event.getId(), event.getType());

        if ("checkout.session.completed".equals(event.getType())) {
            handleCheckoutSessionCompleted(event);
        } else if ("payment_intent.succeeded".equals(event.getType())) {
            handlePaymentIntentSucceeded(event);
        } else if ("payment_intent.payment_failed".equals(event.getType())
                || "payment_intent.canceled".equals(event.getType())) {
            handlePaymentIntentFailed(event);
        } else {
            log.info("Stripe webhook ignored unsupported event type={}", event.getType());
        }

        return ResponseEntity.ok("received");
    }

    private void handlePaymentIntentSucceeded(Event event) {
        PaymentIntent paymentIntent = deserializePaymentIntent(event);
        if (paymentIntent == null) {
            return;
        }

        Optional<PaymentAttempt> optionalAttempt = findAttemptForPaymentIntent(paymentIntent);

        if (optionalAttempt.isEmpty()) {
            log.warn("No payment attempt found for Stripe payment intent: paymentIntentId={}, metadata={}",
                    paymentIntent.getId(), paymentIntent.getMetadata());
            return;
        }

        PaymentAttempt attempt = optionalAttempt.get();

        log.info("Processing Stripe payment_intent.succeeded: paymentIntentId={}, attemptId={}, bookingId={}, currentStatus={}",
                paymentIntent.getId(), attempt.getId(), attempt.getBookingId(), attempt.getStatus());

        if (attempt.getStatus() == PaymentAttemptStatus.SUCCEEDED) {
            log.info("Stripe payment attempt already succeeded: attemptId={}, paymentIntentId={}",
                    attempt.getId(), paymentIntent.getId());
        } else {
            attempt.setStatus(PaymentAttemptStatus.SUCCEEDED);
            attempt.setUpdatedAt(Instant.now());
            attempts.save(attempt);
            log.info("Stripe payment attempt marked succeeded: attemptId={}, paymentIntentId={}, bookingId={}",
                    attempt.getId(), paymentIntent.getId(), attempt.getBookingId());
        }

        var booking = bookingService.markCompletedFromPayment(attempt.getBookingId());
        if (booking != null && booking.getStatus() == com.untamed.untamedbackend.booking.BookingStatus.COMPLETED) {
            guestPassService.generatePassesForPaidBooking(attempt.getBookingId());
        }

        log.info("Stripe payment intent succeeded and booking completion processed: paymentIntentId={}, bookingId={}",
                paymentIntent.getId(), attempt.getBookingId());
    }

    private void handlePaymentIntentFailed(Event event) {
        PaymentIntent paymentIntent = deserializePaymentIntent(event);
        if (paymentIntent == null) {
            return;
        }

        Optional<PaymentAttempt> optionalAttempt = findAttemptForPaymentIntent(paymentIntent);

        if (optionalAttempt.isEmpty()) {
            log.warn("No payment attempt found for failed Stripe payment intent: paymentIntentId={}, metadata={}",
                    paymentIntent.getId(), paymentIntent.getMetadata());
            return;
        }

        PaymentAttempt attempt = optionalAttempt.get();
        attempt.setStatus(PaymentAttemptStatus.FAILED);
        attempt.setUpdatedAt(Instant.now());
        attempts.save(attempt);

        bookingService.handlePaymentFailed(attempt.getBookingId());

        log.info("Stripe payment intent failed/cancelled and booking payment state reset if needed: paymentIntentId={}, bookingId={}",
                paymentIntent.getId(), attempt.getBookingId());
    }

    private Optional<PaymentAttempt> findAttemptForPaymentIntent(PaymentIntent paymentIntent) {
        Optional<PaymentAttempt> byProviderRef =
                attempts.findByProviderAndProviderRef(PaymentProvider.STRIPE, paymentIntent.getId());
        if (byProviderRef.isPresent()) {
            return byProviderRef;
        }

        Map<String, String> metadata = paymentIntent.getMetadata();
        if (metadata == null || metadata.isEmpty()) {
            return Optional.empty();
        }

        String attemptId = metadata.get("attemptId");
        if (attemptId != null && !attemptId.isBlank()) {
            Optional<PaymentAttempt> byAttemptId = attempts.findById(attemptId);
            if (byAttemptId.isPresent() && byAttemptId.get().getProvider() == PaymentProvider.STRIPE) {
                return byAttemptId;
            }
        }

        String bookingId = metadata.get("bookingId");
        if (bookingId == null || bookingId.isBlank()) {
            return Optional.empty();
        }

        return attempts.findFirstByBookingIdAndProviderAndStatusInOrderByCreatedAtDesc(
                bookingId,
                PaymentProvider.STRIPE,
                List.of(PaymentAttemptStatus.PENDING, PaymentAttemptStatus.CREATED, PaymentAttemptStatus.SUCCEEDED)
        );
    }

    private PaymentIntent deserializePaymentIntent(Event event) {
        try {
            return (PaymentIntent) event.getDataObjectDeserializer()
                    .deserializeUnsafe();
        } catch (Exception e) {
            System.out.println("Could not deserialize Stripe payment intent: " + e.getMessage());
            return null;
        }
    }

    private void handleCheckoutSessionCompleted(Event event) {
        Session session;

        try {
            session = (Session) event.getDataObjectDeserializer()
                    .deserializeUnsafe();
        } catch (Exception e) {
            System.out.println("Could not deserialize Stripe checkout session: " + e.getMessage());
            return;
        }

        if (session == null) {
            System.out.println("Stripe checkout session is null");
            return;
        }

        String sessionId = session.getId();
        System.out.println("Checkout session completed: " + sessionId);

        Optional<PaymentAttempt> optionalAttempt =
                attempts.findByProviderAndProviderRef(PaymentProvider.STRIPE, sessionId);

        if (optionalAttempt.isEmpty()) {
            System.out.println("No payment attempt found for Stripe session: " + sessionId);
            return;
        }

        PaymentAttempt attempt = optionalAttempt.get();

        if (attempt.getStatus() == PaymentAttemptStatus.SUCCEEDED) {
            System.out.println("Payment attempt already succeeded: " + attempt.getId());

            var booking = bookingService.markCompletedFromPayment(attempt.getBookingId());
            if (booking != null && booking.getStatus() == com.untamed.untamedbackend.booking.BookingStatus.COMPLETED) {
                // Important: if Stripe retries the webhook but passes were not created before,
                // this safely creates them because GuestPassService checks if they already exist.
                guestPassService.generatePassesForPaidBooking(attempt.getBookingId());
            }

            return;
        }

        attempt.setStatus(PaymentAttemptStatus.SUCCEEDED);
        attempt.setUpdatedAt(Instant.now());
        attempts.save(attempt);

        var booking = bookingService.markCompletedFromPayment(attempt.getBookingId());
        if (booking != null && booking.getStatus() == com.untamed.untamedbackend.booking.BookingStatus.COMPLETED) {
            guestPassService.generatePassesForPaidBooking(attempt.getBookingId());
        }

        System.out.println("Payment succeeded and booking completion was processed: " + attempt.getBookingId());
    }
}

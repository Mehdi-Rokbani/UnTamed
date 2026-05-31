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
import java.util.Optional;

@RestController
@RequestMapping("/api/payments/stripe")
@RequiredArgsConstructor
public class StripeWebhookController {

    private static final Logger log = LoggerFactory.getLogger(StripeWebhookController.class);

    private final StripeProperties stripeProps;
    private final PaymentAttemptRepository attempts;
    private final BookingService bookingService;
    private final GuestPassService guestPassService;

    @PostMapping("/webhook")
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

        if ("checkout.session.completed".equals(event.getType())) {
            handleCheckoutSessionCompleted(event);
        }

        if ("payment_intent.succeeded".equals(event.getType())) {
            handlePaymentIntentSucceeded(event);
        }

        if ("payment_intent.payment_failed".equals(event.getType())
                || "payment_intent.canceled".equals(event.getType())) {
            handlePaymentIntentFailed(event);
        }

        return ResponseEntity.ok("received");
    }

    private void handlePaymentIntentSucceeded(Event event) {
        PaymentIntent paymentIntent = deserializePaymentIntent(event);
        if (paymentIntent == null) {
            return;
        }

        Optional<PaymentAttempt> optionalAttempt =
                attempts.findByProviderAndProviderRef(PaymentProvider.STRIPE, paymentIntent.getId());

        if (optionalAttempt.isEmpty()) {
            System.out.println("No payment attempt found for Stripe payment intent: " + paymentIntent.getId());
            return;
        }

        PaymentAttempt attempt = optionalAttempt.get();

        if (attempt.getStatus() != PaymentAttemptStatus.SUCCEEDED) {
            attempt.setStatus(PaymentAttemptStatus.SUCCEEDED);
            attempt.setUpdatedAt(Instant.now());
            attempts.save(attempt);
        }

        var booking = bookingService.markCompletedFromPayment(attempt.getBookingId());
        if (booking != null && booking.getStatus() == com.untamed.untamedbackend.booking.BookingStatus.COMPLETED) {
            guestPassService.generatePassesForPaidBooking(attempt.getBookingId());
        }

        System.out.println("PaymentIntent succeeded and booking completion was processed: "
                + attempt.getBookingId());
    }

    private void handlePaymentIntentFailed(Event event) {
        PaymentIntent paymentIntent = deserializePaymentIntent(event);
        if (paymentIntent == null) {
            return;
        }

        Optional<PaymentAttempt> optionalAttempt =
                attempts.findByProviderAndProviderRef(PaymentProvider.STRIPE, paymentIntent.getId());

        if (optionalAttempt.isEmpty()) {
            System.out.println("No payment attempt found for failed Stripe payment intent: " + paymentIntent.getId());
            return;
        }

        PaymentAttempt attempt = optionalAttempt.get();
        attempt.setStatus(PaymentAttemptStatus.FAILED);
        attempt.setUpdatedAt(Instant.now());
        attempts.save(attempt);

        bookingService.handlePaymentFailed(attempt.getBookingId());

        System.out.println("PaymentIntent failed/cancelled, booking payment state reset if needed: "
                + attempt.getBookingId());
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

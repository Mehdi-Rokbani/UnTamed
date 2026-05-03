package com.untamed.untamedbackend.payment.stripe;

import com.stripe.exception.SignatureVerificationException;
import com.stripe.model.Event;
import com.stripe.model.checkout.Session;
import com.stripe.net.Webhook;
import com.untamed.untamedbackend.booking.BookingService;
import com.untamed.untamedbackend.payment.PaymentAttempt;
import com.untamed.untamedbackend.payment.PaymentAttemptRepository;
import com.untamed.untamedbackend.payment.PaymentAttemptStatus;
import com.untamed.untamedbackend.payment.PaymentProvider;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.util.Optional;

@RestController
@RequestMapping("/api/payments/stripe")
@RequiredArgsConstructor
public class StripeWebhookController {

    private final StripeProperties stripeProps;
    private final PaymentAttemptRepository attempts;
    private final BookingService bookingService;

    @PostMapping("/webhook")
    public ResponseEntity<String> webhook(
            @RequestBody String payload,
            @RequestHeader("Stripe-Signature") String sigHeader
    ) {
        Event event;

        try {
            event = Webhook.constructEvent(
                    payload,
                    sigHeader,
                    stripeProps.getWebhookSecret()
            );
        } catch (SignatureVerificationException e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body("Invalid signature");
        }

        if ("checkout.session.completed".equals(event.getType())) {
            handleCheckoutSessionCompleted(event);
        }

        return ResponseEntity.ok("received");
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
            return;
        }

        attempt.setStatus(PaymentAttemptStatus.SUCCEEDED);
        attempt.setUpdatedAt(Instant.now());
        attempts.save(attempt);

        bookingService.markCompleted(attempt.getBookingId());

        System.out.println("Payment succeeded and booking completed: " + attempt.getBookingId());
    }
}
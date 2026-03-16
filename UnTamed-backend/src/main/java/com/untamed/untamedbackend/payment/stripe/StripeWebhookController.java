package com.untamed.untamedbackend.payment.stripe;

import com.stripe.exception.SignatureVerificationException;
import com.stripe.model.Event;
import com.stripe.model.checkout.Session;
import com.stripe.net.Webhook;
import com.untamed.untamedbackend.payment.PaymentAttempt;
import com.untamed.untamedbackend.payment.PaymentAttemptRepository;
import com.untamed.untamedbackend.payment.PaymentAttemptStatus;
import com.untamed.untamedbackend.payment.PaymentProvider;
import com.untamed.untamedbackend.booking.BookingService;
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
            System.out.println("Webhook secret: " + stripeProps.getWebhookSecret());
        } catch (SignatureVerificationException e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body("Invalid signature");
        }

        switch (event.getType()) {
            case "checkout.session.completed" -> handleCheckoutSessionCompleted(event);
            case "payment_intent.payment_failed" -> handlePaymentFailed(event);
            default -> {
                // ignore unneeded events
            }
        }

        return ResponseEntity.ok("received");
    }

    private void handleCheckoutSessionCompleted(Event event) {
        Session session = (Session) event.getDataObjectDeserializer()
                .getObject()
                .orElse(null);

        if (session == null) return;

        String sessionId = session.getId();

        Optional<PaymentAttempt> optionalAttempt =
                attempts.findByProviderAndProviderRef(PaymentProvider.STRIPE, sessionId);

        if (optionalAttempt.isEmpty()) return;

        PaymentAttempt attempt = optionalAttempt.get();

        if (attempt.getStatus() == PaymentAttemptStatus.SUCCEEDED) {
            return;
        }

        attempt.setStatus(PaymentAttemptStatus.SUCCEEDED);
        attempt.setUpdatedAt(Instant.now());
        attempts.save(attempt);

        bookingService.markCompleted(attempt.getBookingId());
    }

    private void handlePaymentFailed(Event event) {
        // optional for now
        // checkout flow is mostly confirmed by checkout.session.completed
        // so failure handling can be added later if needed
    }
}
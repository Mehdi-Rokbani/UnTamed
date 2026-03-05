package com.untamed.untamedbackend.payment;

import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

/**
 * Konnect webhook is a GET request with ?payment_ref=...
 * We NEVER trust the query alone; we always call Konnect get-payment-details to confirm. :contentReference[oaicite:2]{index=2}
 */
@RestController
@RequestMapping("/api/payments/konnect")
@RequiredArgsConstructor
public class KonnectWebhookController {

    private final KonnectPaymentService konnectPaymentService;

    @GetMapping("/webhook")
    public ResponseEntity<Void> webhook(@RequestParam("payment_ref") String paymentRef) {
        // BookingId fallback not needed if we stored PaymentAttempt with providerRef
        konnectPaymentService.verifyByProviderRef(paymentRef, null);
        return ResponseEntity.ok().build();
    }
}
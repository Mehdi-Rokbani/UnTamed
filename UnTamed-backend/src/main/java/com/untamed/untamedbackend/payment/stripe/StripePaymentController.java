package com.untamed.untamedbackend.payment.stripe;

import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/payments/stripe")
@RequiredArgsConstructor
public class StripePaymentController {

    private final StripePaymentService stripePaymentService;

    @PostMapping("/create/{bookingId}")
    public StripeCreatePaymentResponse createPayment(
            @PathVariable String bookingId,
            Authentication authentication
    ) {
        String userId = authentication.getName();
        return stripePaymentService.create(userId, bookingId);
    }
}
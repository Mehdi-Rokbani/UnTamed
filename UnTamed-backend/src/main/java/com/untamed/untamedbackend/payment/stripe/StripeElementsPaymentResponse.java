package com.untamed.untamedbackend.payment.stripe;

import lombok.AllArgsConstructor;
import lombok.Data;

import java.time.Instant;

@Data
@AllArgsConstructor
public class StripeElementsPaymentResponse {
    private String clientSecret;
    private String bookingId;
    private int amount;
    private String currency;
    private Instant expiresAt;
    private String paymentAttemptId;
    private String providerRef;
}

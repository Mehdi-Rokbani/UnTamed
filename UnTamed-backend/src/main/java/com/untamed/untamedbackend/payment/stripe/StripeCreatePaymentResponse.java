package com.untamed.untamedbackend.payment.stripe;

import lombok.AllArgsConstructor;
import lombok.Data;

@Data
@AllArgsConstructor
public class StripeCreatePaymentResponse {
    private String checkoutUrl;
    private String sessionId;
}
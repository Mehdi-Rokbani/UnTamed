package com.untamed.untamedbackend.payment.Konnect_disabled;

import lombok.*;

import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class KonnectInitRequest {
    private String receiverWalletId;
    private String token; // TND
    private int amount;   // millimes for TND
    private String type;  // "immediate"
    private String description;

    @Builder.Default
    private List<String> acceptedPaymentMethods = List.of("wallet", "bank_card", "e-DINAR");

    private Integer lifespan; // minutes
    private Boolean checkoutForm;
    private Boolean addPaymentFeesToAmount;

    private String orderId;

    // Konnect webhook docs: GET with payment_ref
    private String webhook;

    // deprecated in docs but still commonly used in practice
    private String successUrl;
    private String failUrl;
}
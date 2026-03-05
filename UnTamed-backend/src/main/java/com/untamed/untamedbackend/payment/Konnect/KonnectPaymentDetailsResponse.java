package com.untamed.untamedbackend.payment.Konnect;

import lombok.Data;

@Data
public class KonnectPaymentDetailsResponse {
    private Payment payment;

    @Data
    public static class Payment {
        private String id;
        private String status; // e.g., "pending"
        private Integer amount;
        private String token;
    }
}
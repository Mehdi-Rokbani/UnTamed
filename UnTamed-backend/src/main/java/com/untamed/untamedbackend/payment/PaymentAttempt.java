package com.untamed.untamedbackend.payment;

import lombok.*;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@Document(collection = "payment_attempts")
public class PaymentAttempt {

    @Id
    private String id;

    @Indexed
    private String bookingId;

    @Indexed
    private String userId;

    @Indexed
    private PaymentProvider provider;

    @Indexed
    private PaymentAttemptStatus status;

    // Money
    private int amount;        // millimes for TND per Konnect docs
    private String token;      // TND/EUR/USD

    // Provider references
    @Indexed(sparse = true)
    private String providerRef; // Konnect paymentRef

    @Indexed(unique = true)
    private String idempotencyKey;

    private Instant createdAt;
    private Instant updatedAt;
}
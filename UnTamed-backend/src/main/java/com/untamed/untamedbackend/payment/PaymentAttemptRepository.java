package com.untamed.untamedbackend.payment;

import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;
import java.util.Optional;

public interface PaymentAttemptRepository extends MongoRepository<PaymentAttempt, String> {

    Optional<PaymentAttempt> findFirstByBookingIdAndProviderOrderByCreatedAtDesc(String bookingId, PaymentProvider provider);

    Optional<PaymentAttempt> findFirstByBookingIdAndProviderAndStatusOrderByCreatedAtDesc(
            String bookingId,
            PaymentProvider provider,
            PaymentAttemptStatus status
    );

    Optional<PaymentAttempt> findFirstByBookingIdAndProviderAndStatusInOrderByCreatedAtDesc(
            String bookingId,
            PaymentProvider provider,
            List<PaymentAttemptStatus> statuses
    );

    Optional<PaymentAttempt> findFirstByBookingIdAndStatusOrderByCreatedAtDesc(
            String bookingId,
            PaymentAttemptStatus status
    );

    Optional<PaymentAttempt> findByProviderAndProviderRef(PaymentProvider provider, String providerRef);

    boolean existsByIdempotencyKey(String idempotencyKey);

    List<PaymentAttempt> findByStatus(PaymentAttemptStatus status);

}

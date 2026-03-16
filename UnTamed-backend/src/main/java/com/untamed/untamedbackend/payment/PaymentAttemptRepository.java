package com.untamed.untamedbackend.payment;

import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.Optional;

public interface PaymentAttemptRepository extends MongoRepository<PaymentAttempt, String> {

    Optional<PaymentAttempt> findFirstByBookingIdAndProviderOrderByCreatedAtDesc(String bookingId, PaymentProvider provider);

    Optional<PaymentAttempt> findByProviderAndProviderRef(PaymentProvider provider, String providerRef);

    boolean existsByIdempotencyKey(String idempotencyKey);

}
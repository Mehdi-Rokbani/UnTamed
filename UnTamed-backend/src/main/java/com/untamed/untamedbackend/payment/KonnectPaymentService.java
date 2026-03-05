package com.untamed.untamedbackend.payment;

import com.untamed.untamedbackend.booking.Booking;
import com.untamed.untamedbackend.booking.BookingService;
import com.untamed.untamedbackend.payment.Konnect.*;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class KonnectPaymentService {

    private final com.untamed.untamedbackend.payment.konnect.KonnectClient konnectClient;
    private final KonnectProperties konnectProps;

    private final PaymentAttemptRepository attempts;
    private final BookingService bookingService;

    /**
     * Create Konnect payment session and return payUrl.
     */
    public KonnectCreatePaymentResponse create(String userId, String bookingId) {

        // Move booking -> PAYING (idempotent)
        Booking b = bookingService.markPaying(bookingId, userId);

        // IMPORTANT: compute amount server-side (placeholder)
        // TODO: replace with real price calculation from session/template
        int amountMillimes = computeAmountMillimes(b);

        // idempotency: stable key per booking attempt creation call
        String idemKey = "konnect:" + bookingId + ":" + UUID.randomUUID();

        PaymentAttempt attempt = PaymentAttempt.builder()
                .bookingId(bookingId)
                .userId(userId)
                .provider(PaymentProvider.KONNECT)
                .status(PaymentAttemptStatus.CREATED)
                .amount(amountMillimes)
                .token(konnectProps.getToken())
                .idempotencyKey(idemKey)
                .createdAt(Instant.now())
                .updatedAt(Instant.now())
                .build();

        attempt = attempts.save(attempt);

        KonnectInitRequest req = KonnectInitRequest.builder()
                .receiverWalletId(konnectProps.getReceiverWalletId())
                .token(konnectProps.getToken())
                .amount(amountMillimes)
                .type("immediate")
                .description("Booking payment: " + bookingId)
                .lifespan(konnectProps.getDefaultLifespanMinutes())
                .checkoutForm(true)
                .addPaymentFeesToAmount(false)
                .orderId(bookingId)
                .webhook(konnectProps.getWebhookUrl())
                .successUrl(konnectProps.getSuccessUrl())
                .failUrl(konnectProps.getFailUrl())
                .build();

        KonnectInitResponse resp = konnectClient.initPayment(req);
        if (resp == null || resp.getPaymentRef() == null || resp.getPayUrl() == null) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Konnect init-payment failed");
        }

        attempt.setProviderRef(resp.getPaymentRef());
        attempt.setStatus(PaymentAttemptStatus.PENDING);
        attempt.setUpdatedAt(Instant.now());
        attempts.save(attempt);

        return new KonnectCreatePaymentResponse(resp.getPayUrl(), resp.getPaymentRef());
    }

    /**
     * Verify by bookingId: calls Konnect get-payment-details and updates booking/payment attempt.
     */
    public KonnectVerifyResponse verifyByBooking(String userId, String bookingId) {
        PaymentAttempt attempt = attempts.findFirstByBookingIdAndProviderOrderByCreatedAtDesc(bookingId, PaymentProvider.KONNECT)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "No payment attempt for booking"));

        if (!attempt.getUserId().equals(userId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Not your payment attempt");
        }

        return verifyByProviderRef(attempt.getProviderRef(), bookingId);
    }

    /**
     * Verify by provider ref (used by webhook).
     */
    public KonnectVerifyResponse verifyByProviderRef(String paymentRef, String bookingIdFallback) {
        if (paymentRef == null || paymentRef.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Missing payment_ref");
        }

        PaymentAttempt attempt = attempts.findByProviderAndProviderRef(PaymentProvider.KONNECT, paymentRef)
                .orElse(null);

        String bookingId = attempt != null ? attempt.getBookingId() : bookingIdFallback;

        KonnectPaymentDetailsResponse details = konnectClient.getPaymentDetails(paymentRef);
        if (details == null || details.getPayment() == null) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Konnect get-payment-details failed");
        }

        String status = normalize(details.getPayment().getStatus());

        // Idempotency: if already succeeded, do nothing
        if (attempt != null && attempt.getStatus() == PaymentAttemptStatus.SUCCEEDED) {
            return new KonnectVerifyResponse("succeeded");
        }

        // Map status -> booking transitions
        if (isSuccess(status)) {
            if (attempt != null) {
                attempt.setStatus(PaymentAttemptStatus.SUCCEEDED);
                attempt.setUpdatedAt(Instant.now());
                attempts.save(attempt);
            }
            bookingService.markCompleted(bookingId);
            return new KonnectVerifyResponse("succeeded");
        }

        if (isFailure(status)) {
            if (attempt != null) {
                attempt.setStatus(PaymentAttemptStatus.FAILED);
                attempt.setUpdatedAt(Instant.now());
                attempts.save(attempt);
            }
            bookingService.handlePaymentFailed(bookingId);
            return new KonnectVerifyResponse("failed");
        }

        // still pending
        if (attempt != null) {
            attempt.setStatus(PaymentAttemptStatus.PENDING);
            attempt.setUpdatedAt(Instant.now());
            attempts.save(attempt);
        }
        return new KonnectVerifyResponse("pending");
    }

    // -------- helpers --------

    private int computeAmountMillimes(Booking b) {
        // placeholder: 10 TND per person -> 10_000 millimes
        // Replace with real pricing.
        return Math.max(1, b.getNumberOfPeople()) * 10_000;
    }

    private String normalize(String s) {
        return s == null ? "" : s.trim().toLowerCase();
    }

    private boolean isSuccess(String status) {
        // Konnect docs show "pending". Real success string can vary by provider config.
        // Common: "paid", "completed", "success", "succeeded"
        return status.equals("paid") || status.equals("completed") || status.equals("success") || status.equals("succeeded");
    }

    private boolean isFailure(String status) {
        return status.equals("failed") || status.equals("canceled") || status.equals("cancelled") || status.equals("refused") || status.equals("declined");
    }
}
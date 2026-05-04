package com.untamed.untamedbackend.booking;

import com.untamed.untamedbackend.model.ActivitySession;
import com.untamed.untamedbackend.payment.PaymentAttempt;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.time.Duration;
import java.time.Instant;

@Service
public class RefundPolicyService {

    public void assertBeforeSessionStart(ActivitySession session) {
        if (session.getStartAt() == null) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "Session start time is missing."
            );
        }

        if (!Instant.now().isBefore(session.getStartAt())) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "Cancellation is not allowed after the session has started."
            );
        }
    }

    public RefundPreviewResponse previewUserCancellation(
            Booking booking,
            ActivitySession session,
            PaymentAttempt paymentAttempt
    ) {
        assertBeforeSessionStart(session);

        if (booking.getStatus() != BookingStatus.COMPLETED) {
            return RefundPreviewResponse.builder()
                    .refundable(false)
                    .refundPercent(0)
                    .refundAmount(0)
                    .currency(paymentAttempt != null ? paymentAttempt.getCurrency() : null)
                    .refundStatus(RefundStatus.NONE)
                    .reason("No refund is needed because this booking has not been paid.")
                    .build();
        }

        int percent = calculateUserRefundPercent(session);
        int amount = calculateAmount(paymentAttempt, percent);

        RefundStatus status;
        String reason;

        if (percent == 100) {
            status = RefundStatus.REFUND_PENDING;
            reason = "Cancellation is at least 48 hours before the session. Full refund applies.";
        } else if (percent == 50) {
            status = RefundStatus.REFUND_PENDING;
            reason = "Cancellation is between 24 and 48 hours before the session. 50% refund applies.";
        } else {
            status = RefundStatus.NOT_REFUNDABLE;
            reason = "Cancellation is less than 24 hours before the session. No refund applies.";
        }

        return RefundPreviewResponse.builder()
                .refundable(percent > 0)
                .refundPercent(percent)
                .refundAmount(amount)
                .currency(paymentAttempt != null ? paymentAttempt.getCurrency() : null)
                .refundStatus(status)
                .reason(reason)
                .build();
    }

    public RefundPreviewResponse previewGuideRemoval(
            Booking booking,
            ActivitySession session,
            PaymentAttempt paymentAttempt
    ) {
        assertBeforeSessionStart(session);

        if (booking.getStatus() != BookingStatus.COMPLETED) {
            return RefundPreviewResponse.builder()
                    .refundable(false)
                    .refundPercent(0)
                    .refundAmount(0)
                    .currency(paymentAttempt != null ? paymentAttempt.getCurrency() : null)
                    .refundStatus(RefundStatus.NONE)
                    .reason("No refund is needed because this booking has not been paid.")
                    .build();
        }

        int amount = calculateAmount(paymentAttempt, 100);

        return RefundPreviewResponse.builder()
                .refundable(true)
                .refundPercent(100)
                .refundAmount(amount)
                .currency(paymentAttempt != null ? paymentAttempt.getCurrency() : null)
                .refundStatus(RefundStatus.REFUND_PENDING)
                .reason("Guide removed the participant before the session starts. Full refund applies.")
                .build();
    }

    public RefundPreviewResponse previewGuideSessionCancellation(
            Booking booking,
            ActivitySession session,
            PaymentAttempt paymentAttempt
    ) {
        assertBeforeSessionStart(session);

        if (booking.getStatus() != BookingStatus.COMPLETED) {
            return RefundPreviewResponse.builder()
                    .refundable(false)
                    .refundPercent(0)
                    .refundAmount(0)
                    .currency(paymentAttempt != null ? paymentAttempt.getCurrency() : null)
                    .refundStatus(RefundStatus.NONE)
                    .reason("No refund is needed because this booking has not been paid.")
                    .build();
        }

        int amount = calculateAmount(paymentAttempt, 100);

        return RefundPreviewResponse.builder()
                .refundable(true)
                .refundPercent(100)
                .refundAmount(amount)
                .currency(paymentAttempt != null ? paymentAttempt.getCurrency() : null)
                .refundStatus(RefundStatus.REFUND_PENDING)
                .reason("Guide cancelled the session before it starts. Full refund applies.")
                .build();
    }

    private int calculateUserRefundPercent(ActivitySession session) {
        Duration untilStart = Duration.between(Instant.now(), session.getStartAt());

        if (untilStart.compareTo(Duration.ofHours(48)) >= 0) {
            return 100;
        }

        if (untilStart.compareTo(Duration.ofHours(24)) >= 0) {
            return 50;
        }

        return 0;
    }

    private int calculateAmount(PaymentAttempt attempt, int percent) {
        if (attempt == null || percent <= 0) {
            return 0;
        }

        return Math.round(attempt.getAmount() * (percent / 100.0f));
    }
}
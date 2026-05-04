package com.untamed.untamedbackend.payment.stripe;

import com.stripe.exception.StripeException;
import com.stripe.model.Refund;
import com.stripe.model.checkout.Session;
import com.stripe.param.RefundCreateParams;
import com.stripe.param.checkout.SessionRetrieveParams;
import com.untamed.untamedbackend.payment.PaymentAttempt;
import com.untamed.untamedbackend.payment.PaymentAttemptStatus;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

@Service
public class StripeRefundService {

    public String refundPaymentAttempt(PaymentAttempt attempt, int amount, String reason) {
        if (attempt == null) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Payment attempt not found.");
        }

        if (attempt.getStatus() != PaymentAttemptStatus.SUCCEEDED) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Only succeeded payments can be refunded.");
        }

        if (attempt.getProviderRef() == null || attempt.getProviderRef().isBlank()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Stripe checkout session reference is missing.");
        }

        if (amount <= 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Refund amount must be greater than 0.");
        }

        try {
            SessionRetrieveParams retrieveParams = SessionRetrieveParams.builder()
                    .addExpand("payment_intent")
                    .build();

            Session checkoutSession = Session.retrieve(
                    attempt.getProviderRef(),
                    retrieveParams,
                    null
            );

            String paymentIntentId = checkoutSession.getPaymentIntent();

            if (paymentIntentId == null || paymentIntentId.isBlank()) {
                throw new ResponseStatusException(HttpStatus.CONFLICT, "Stripe payment intent is missing.");
            }

            RefundCreateParams params = RefundCreateParams.builder()
                    .setPaymentIntent(paymentIntentId)
                    .setAmount((long) amount)
                    .putMetadata("bookingId", attempt.getBookingId())
                    .putMetadata("paymentAttemptId", attempt.getId())
                    .putMetadata("reason", reason == null ? "" : reason)
                    .build();

            Refund refund = Refund.create(params);

            return refund.getId();

        } catch (StripeException e) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_GATEWAY,
                    "Stripe refund failed"
            );
        }
    }
}
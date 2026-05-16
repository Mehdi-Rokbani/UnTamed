package com.untamed.untamedbackend.payment.stripe;

import com.untamed.untamedbackend.booking.BookingService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/payments/stripe")
@RequiredArgsConstructor
public class StripePaymentController {

    private final StripePaymentService stripePaymentService;
    private final BookingService bookingService;

    @PostMapping("/create/{bookingId}")
    public StripeCreatePaymentResponse createPayment(
            @PathVariable String bookingId,
            Authentication authentication
    ) {
        String userId = bookingService.requireAuthenticatedDbUserId(authentication);
        return stripePaymentService.create(userId, bookingId);
    }

    @PostMapping("/elements/create/{bookingId}")
    public StripeElementsPaymentResponse createElementsPayment(
            @PathVariable String bookingId,
            Authentication authentication
    ) {
        String userId = bookingService.requireAuthenticatedDbUserId(authentication);
        return stripePaymentService.createElementsPayment(userId, bookingId);
    }

    @PostMapping("/cancel/{bookingId}")
    public void cancelPayment(
            @PathVariable String bookingId,
            Authentication authentication
    ) {
        String userId = bookingService.requireAuthenticatedDbUserId(authentication);
        stripePaymentService.cancelPayment(userId, bookingId);
    }
}

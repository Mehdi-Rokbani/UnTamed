package com.untamed.untamedbackend.payment.Konnect_disabled;

import com.untamed.untamedbackend.booking.BookingService;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/payments/konnect")
@RequiredArgsConstructor
public class KonnectPaymentController {

    private final KonnectPaymentService konnectPaymentService;
    private final BookingService bookingService;

    @PostMapping("/create")
    public ResponseEntity<KonnectCreatePaymentResponse> create(
            @RequestParam String bookingId,
            Authentication auth,
            HttpServletResponse res
    ) {
        System.out.println("START committed=" + res.isCommitted());
        String userId = bookingService.requireUserId(auth);
        System.out.println("END committed=" + res.isCommitted());
        return ResponseEntity.ok(konnectPaymentService.create(userId, bookingId));
    }

    @GetMapping("/verify")
    public ResponseEntity<KonnectVerifyResponse> verify(
            @RequestParam String bookingId,
            Authentication auth
    ) {
        String userId = bookingService.requireUserId(auth);
        return ResponseEntity.ok(konnectPaymentService.verifyByBooking(userId, bookingId));
    }
}
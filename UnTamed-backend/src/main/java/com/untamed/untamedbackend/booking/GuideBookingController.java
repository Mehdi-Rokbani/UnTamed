package com.untamed.untamedbackend.booking;

import com.untamed.untamedbackend.dto.GuideParticipantDto;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/guide/sessions")
@RequiredArgsConstructor
public class GuideBookingController {

    private final BookingService bookingService;

    @GetMapping("/{sessionId}/participants")
    public ResponseEntity<List<GuideParticipantDto>> participants(
            @PathVariable String sessionId,
            Authentication auth
    ) {
        String guideId = bookingService.requireAuthenticatedDbUserId(auth);
        return ResponseEntity.ok(bookingService.listParticipantsForGuide(sessionId, guideId));
    }

    @GetMapping("/{sessionId}/bookings")
    public ResponseEntity<List<GuideParticipantDto>> bookings(
            @PathVariable String sessionId,
            Authentication auth
    ) {
        String guideId = bookingService.requireAuthenticatedDbUserId(auth);
        return ResponseEntity.ok(bookingService.listAllBookingsForGuide(sessionId, guideId));
    }

    @PostMapping("/bookings/{bookingId}/cancel-pending")
    public ResponseEntity<CancelBookingResponse> cancelPendingBooking(
            @PathVariable String bookingId,
            Authentication auth
    ) {
        String guideId = bookingService.requireAuthenticatedDbUserId(auth);
        return ResponseEntity.ok(bookingService.cancelPendingBookingByGuide(bookingId, guideId));
    }
}
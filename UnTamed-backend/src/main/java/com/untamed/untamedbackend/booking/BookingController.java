package com.untamed.untamedbackend.booking;

import com.untamed.untamedbackend.dto.GuideParticipantDto;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/bookings")
@RequiredArgsConstructor
public class BookingController {

    private final BookingService bookingService;

    @PostMapping
    public ResponseEntity<Booking> createOrIncrease(
            @RequestBody CreateBookingRequest request,
            Authentication auth
    ) {
        String userId = bookingService.requireUserId(auth);

        Booking booking = bookingService.createOrIncreaseBooking(
                userId,
                request.getSessionId(),
                request.getNumberOfPeople()
        );

        return ResponseEntity.ok(booking);
    }

    @PostMapping("/{id}/increase")
    public ResponseEntity<Booking> increase(
            @PathVariable String id,
            @RequestParam int delta,
            Authentication auth
    ) {
        String userId = bookingService.requireUserId(auth);
        return ResponseEntity.ok(bookingService.increaseSeats(id, userId, delta));
    }

    @PostMapping("/{id}/decrease")
    public ResponseEntity<Booking> decrease(
            @PathVariable String id,
            @RequestParam int delta,
            Authentication auth
    ) {
        String userId = bookingService.requireUserId(auth);
        return ResponseEntity.ok(bookingService.decreaseSeats(id, userId, delta));
    }

    @PostMapping("/{id}/cancel")
    public ResponseEntity<CancelBookingResponse> cancel(
            @PathVariable String id,
            Authentication auth
    ) {
        String userId = bookingService.requireUserId(auth);
        return ResponseEntity.ok(bookingService.cancelBooking(id, userId));
    }

    @GetMapping("/mine")
    public ResponseEntity<List<Booking>> mine(Authentication auth) {
        String userId = bookingService.requireUserId(auth);
        return ResponseEntity.ok(bookingService.listMine(userId));
    }

    @PostMapping("/{id}/confirm")
    public ResponseEntity<Booking> confirm(
            @PathVariable String id,
            Authentication auth
    ) {
        String userId = bookingService.requireUserId(auth);
        return ResponseEntity.ok(bookingService.confirmBooking(id, userId));
    }

}
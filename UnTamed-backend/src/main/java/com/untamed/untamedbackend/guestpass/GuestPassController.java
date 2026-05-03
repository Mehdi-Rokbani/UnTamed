package com.untamed.untamedbackend.guestpass;

import com.untamed.untamedbackend.booking.BookingErrors;
import com.untamed.untamedbackend.booking.BookingService;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

@RestController
@RequestMapping("/api/guest-passes")
public class GuestPassController {

    private final GuestPassService guestPassService;
    private final BookingService bookingService;

    public GuestPassController(
            GuestPassService guestPassService,
            BookingService bookingService
    ) {
        this.guestPassService = guestPassService;
        this.bookingService = bookingService;
    }

    @GetMapping("/booking/{bookingId}")
    public List<GuestPassDto> getPassesForBooking(@PathVariable String bookingId) {
        return guestPassService.getPassesForBooking(bookingId);
    }

    @GetMapping("/public/{token}")
    public VerifyGuestPassDto publicGuestPass(@PathVariable String token) {
        return guestPassService.verifyPublicByToken(token);
    }

    @GetMapping("/guide/verify/{token}")
    public VerifyGuestPassDto guideVerifyGuestPass(
            @PathVariable String token,
            Authentication auth
    ) {
        String guideId = requireAuthenticatedGuideId(auth);
        return guestPassService.verifyForGuideByToken(token, guideId);
    }

    @PostMapping("/present/{token}")
    public VerifyGuestPassDto markPresent(
            @PathVariable String token,
            Authentication auth
    ) {
        String guideId = requireAuthenticatedGuideId(auth);
        return guestPassService.markPresentByToken(token, guideId);
    }

    @PostMapping("/absent/{token}")
    public VerifyGuestPassDto markAbsent(
            @PathVariable String token,
            Authentication auth
    ) {
        String guideId = requireAuthenticatedGuideId(auth);
        return guestPassService.markAbsentByToken(token, guideId);
    }

    @GetMapping("/guide/session/{sessionId}/attendance")
    public List<GuideGuestPassAttendanceDto> getSessionAttendanceForGuide(
            @PathVariable String sessionId,
            Authentication auth
    ) {
        String guideId = requireAuthenticatedGuideId(auth);
        return guestPassService.getSessionAttendanceForGuide(sessionId, guideId);
    }

    @GetMapping("/guide/history")
    public List<GuideGuestPassAttendanceDto> getGuideAttendanceHistory(Authentication auth) {
        String guideId = requireAuthenticatedGuideId(auth);
        return guestPassService.getGuideAttendanceHistory(guideId);
    }

    private String requireAuthenticatedGuideId(Authentication auth) {
        if (auth == null || !auth.isAuthenticated()) {
            throw new ResponseStatusException(
                    HttpStatus.UNAUTHORIZED,
                    BookingErrors.NOT_AUTHENTICATED
            );
        }

        return bookingService.requireAuthenticatedDbUserId(auth);
    }
}
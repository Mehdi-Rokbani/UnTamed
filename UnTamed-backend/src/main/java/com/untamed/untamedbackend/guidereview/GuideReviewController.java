package com.untamed.untamedbackend.guidereview;

import com.untamed.untamedbackend.booking.BookingService;
import com.untamed.untamedbackend.dto.PaginatedResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/guides/{guideId}/reviews")
@RequiredArgsConstructor
public class GuideReviewController {

    private final GuideReviewService guideReviewService;
    private final BookingService bookingService;

    @PostMapping
    public ResponseEntity<GuideReviewResponse> createGuideReview(
            @PathVariable String guideId,
            @Valid @RequestBody GuideReviewCreateRequest request,
            Authentication auth
    ) {
        String reviewerId = bookingService.requireAuthenticatedDbUserId(auth);
        return ResponseEntity.ok(guideReviewService.createGuideReview(reviewerId, guideId, request));
    }

    @GetMapping
    public ResponseEntity<PaginatedResponse<GuideReviewResponse>> listGuideReviews(
            @PathVariable String guideId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size
    ) {
        return ResponseEntity.ok(guideReviewService.listGuideReviews(
                guideId,
                Math.max(0, page),
                Math.max(1, Math.min(size, 50))
        ));
    }

    @GetMapping("/eligibility")
    public ResponseEntity<GuideReviewEligibilityResponse> getEligibility(
            @PathVariable String guideId,
            @RequestParam String bookingId,
            Authentication auth
    ) {
        String reviewerId = bookingService.requireAuthenticatedDbUserId(auth);
        return ResponseEntity.ok(guideReviewService.getEligibility(reviewerId, guideId, bookingId));
    }
}

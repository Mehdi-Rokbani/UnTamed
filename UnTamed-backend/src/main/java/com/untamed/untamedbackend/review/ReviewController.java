package com.untamed.untamedbackend.review;

import com.untamed.untamedbackend.booking.BookingService;
import com.untamed.untamedbackend.review.CreateReviewRequest;
import com.untamed.untamedbackend.review.ReplyReviewRequest;
import com.untamed.untamedbackend.review.ReviewResponse;
import com.untamed.untamedbackend.review.UpdateReviewRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import com.untamed.untamedbackend.review.ReviewEligibilityResponse;

import java.util.List;

@RestController
@RequestMapping("/api/reviews")
@RequiredArgsConstructor
public class ReviewController {

    private final ReviewService reviewService;
    private final BookingService bookingService;

    @PostMapping
    public ResponseEntity<ReviewResponse> createReview(
            @Valid @RequestBody CreateReviewRequest req,
            Authentication auth
    ) {
        String userId = bookingService.requireAuthenticatedDbUserId(auth);
        return ResponseEntity.ok(reviewService.createReview(userId, req));
    }

    @PutMapping("/{reviewId}")
    public ResponseEntity<ReviewResponse> updateOwnReview(
            @PathVariable String reviewId,
            @Valid @RequestBody UpdateReviewRequest req,
            Authentication auth
    ) {
        String userId = bookingService.requireAuthenticatedDbUserId(auth);
        return ResponseEntity.ok(reviewService.updateOwnReview(userId, reviewId, req));
    }

    @PutMapping("/{reviewId}/reply")
    public ResponseEntity<ReviewResponse> replyToReview(
            @PathVariable String reviewId,
            @Valid @RequestBody ReplyReviewRequest req,
            Authentication auth
    ) {
        String guideId = bookingService.requireAuthenticatedDbUserId(auth);
        return ResponseEntity.ok(reviewService.replyToReview(guideId, reviewId, req));
    }

    @GetMapping("/template/{templateId}")
    public ResponseEntity<List<ReviewResponse>> listTemplateReviews(@PathVariable String templateId) {
        return ResponseEntity.ok(reviewService.listVisibleReviewsForTemplate(templateId));
    }

    @GetMapping("/me/template/{templateId}")
    public ResponseEntity<ReviewResponse> getMyReviewForTemplate(
            @PathVariable String templateId,
            Authentication auth
    ) {
        String userId = bookingService.requireAuthenticatedDbUserId(auth);
        return ResponseEntity.ok(reviewService.getMyReviewForTemplate(userId, templateId));
    }

    @GetMapping("/eligibility/booking/{bookingId}")
    public ResponseEntity<ReviewEligibilityResponse> getReviewEligibility(
            @PathVariable String bookingId,
            Authentication auth
    ) {
        String userId = bookingService.requireAuthenticatedDbUserId(auth);
        return ResponseEntity.ok(bookingService.getReviewEligibility(bookingId, userId));
    }
}
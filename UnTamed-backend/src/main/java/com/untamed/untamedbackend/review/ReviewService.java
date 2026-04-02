package com.untamed.untamedbackend.review;

import com.untamed.untamedbackend.booking.Booking;
import com.untamed.untamedbackend.booking.BookingRepository;
import com.untamed.untamedbackend.booking.BookingStatus;
import com.untamed.untamedbackend.review.CreateReviewRequest;
import com.untamed.untamedbackend.review.ReplyReviewRequest;
import com.untamed.untamedbackend.review.ReviewResponse;
import com.untamed.untamedbackend.review.UpdateReviewRequest;
import com.untamed.untamedbackend.model.ActivitySession;
import com.untamed.untamedbackend.model.ActivityTemplate;
import com.untamed.untamedbackend.model.RatingSummary;
import com.untamed.untamedbackend.model.Review;
import com.untamed.untamedbackend.model.ReviewStatus;
import com.untamed.untamedbackend.repository.ActivitySessionRepository;
import com.untamed.untamedbackend.repository.ActivityTemplateRepository;
import com.untamed.untamedbackend.repository.ReviewRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.List;

@Service
@RequiredArgsConstructor
public class ReviewService {

    private final ReviewRepository reviewRepository;
    private final BookingRepository bookingRepository;
    private final ActivitySessionRepository activitySessionRepository;
    private final ActivityTemplateRepository activityTemplateRepository;

    public ReviewResponse createReview(String currentUserId, CreateReviewRequest req) {
        Booking booking = bookingRepository.findByIdAndUserId(req.getBookingId(), currentUserId)
                .orElseThrow(() -> new IllegalArgumentException("Booking not found"));

        if (booking.getStatus() != BookingStatus.COMPLETED) {
            throw new IllegalArgumentException("Only completed bookings can be reviewed");
        }

        if (booking.isAttendanceMarkedAbsent()) {
            throw new IllegalArgumentException("Absent participants cannot leave reviews");
        }

        ActivitySession session = activitySessionRepository.findById(booking.getSessionId())
                .orElseThrow(() -> new IllegalArgumentException("Session not found"));

        Instant now = Instant.now();
        if (session.getDate() == null || !session.getDate().isBefore(now)) {
            throw new IllegalArgumentException("You can review only after the session date has passed");
        }

        ActivityTemplate template = activityTemplateRepository.findById(session.getTemplateId())
                .orElseThrow(() -> new IllegalArgumentException("Activity template not found"));

        if (template.getGuideId().equals(currentUserId)) {
            throw new IllegalArgumentException("Guide cannot review their own activity");
        }

        if (reviewRepository.existsByReviewerIdAndActivityTemplateId(currentUserId, template.getId())) {
            throw new IllegalArgumentException("You already reviewed this activity");
        }

        Review review = Review.builder()
                .activityTemplateId(template.getId())
                .sessionId(session.getId())
                .bookingId(booking.getId())
                .reviewerId(currentUserId)
                .guideId(template.getGuideId())
                .rating(req.getRating())
                .comment(req.getComment().trim())
                .status(ReviewStatus.VISIBLE)
                .build();

        Review saved;
        try {
            saved = reviewRepository.save(review);
        } catch (DuplicateKeyException e) {
            throw new IllegalArgumentException("You already reviewed this activity");
        }

        recomputeTemplateRating(template.getId());
        return toResponse(saved);
    }

    public ReviewResponse updateOwnReview(String currentUserId, String reviewId, UpdateReviewRequest req) {
        Review review = reviewRepository.findById(reviewId)
                .orElseThrow(() -> new IllegalArgumentException("Review not found"));

        if (!review.getReviewerId().equals(currentUserId)) {
            throw new IllegalArgumentException("You can only edit your own review");
        }

        review.setRating(req.getRating());
        review.setComment(req.getComment().trim());

        Review saved = reviewRepository.save(review);
        recomputeTemplateRating(saved.getActivityTemplateId());

        return toResponse(saved);
    }

    public ReviewResponse replyToReview(String currentGuideId, String reviewId, ReplyReviewRequest req) {
        Review review = reviewRepository.findById(reviewId)
                .orElseThrow(() -> new IllegalArgumentException("Review not found"));

        if (!review.getGuideId().equals(currentGuideId)) {
            throw new IllegalArgumentException("Only the guide of this activity can reply to the review");
        }

        Instant now = Instant.now();

        review.setReplyText(req.getReplyText().trim());
        review.setReplyByGuideId(currentGuideId);

        if (review.getReplyCreatedAt() == null) {
            review.setReplyCreatedAt(now);
        }
        review.setReplyUpdatedAt(now);

        Review saved = reviewRepository.save(review);
        return toResponse(saved);
    }

    public List<ReviewResponse> listVisibleReviewsForTemplate(String templateId) {
        return reviewRepository
                .findByActivityTemplateIdAndStatusOrderByCreatedAtDesc(templateId, ReviewStatus.VISIBLE)
                .stream()
                .map(this::toResponse)
                .toList();
    }

    public ReviewResponse getMyReviewForTemplate(String currentUserId, String templateId) {
        Review review = reviewRepository.findByReviewerIdAndActivityTemplateId(currentUserId, templateId)
                .orElseThrow(() -> new IllegalArgumentException("Review not found"));

        return toResponse(review);
    }

    private void recomputeTemplateRating(String templateId) {
        ActivityTemplate template = activityTemplateRepository.findById(templateId)
                .orElseThrow(() -> new IllegalArgumentException("Activity template not found"));

        List<Review> reviews = reviewRepository
                .findByActivityTemplateIdAndStatusOrderByCreatedAtDesc(templateId, ReviewStatus.VISIBLE);

        int count = reviews.size();
        double average = 0.0;

        if (count > 0) {
            int sum = reviews.stream().mapToInt(Review::getRating).sum();
            average = (double) sum / count;

            average = Math.round(average * 10.0) / 10.0;
        }

        template.setRating(
                RatingSummary.builder()
                        .average(average)
                        .count(count)
                        .build()
        );

        activityTemplateRepository.save(template);
    }

    private ReviewResponse toResponse(Review review) {
        return ReviewResponse.builder()
                .id(review.getId())
                .activityTemplateId(review.getActivityTemplateId())
                .sessionId(review.getSessionId())
                .bookingId(review.getBookingId())
                .reviewerId(review.getReviewerId())
                .guideId(review.getGuideId())
                .rating(review.getRating())
                .comment(review.getComment())
                .status(review.getStatus())
                .replyText(review.getReplyText())
                .replyCreatedAt(review.getReplyCreatedAt())
                .replyUpdatedAt(review.getReplyUpdatedAt())
                .createdAt(review.getCreatedAt())
                .updatedAt(review.getUpdatedAt())
                .build();
    }
}
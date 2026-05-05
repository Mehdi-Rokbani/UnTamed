package com.untamed.untamedbackend.review;

import com.untamed.untamedbackend.booking.Booking;
import com.untamed.untamedbackend.booking.BookingRepository;
import com.untamed.untamedbackend.booking.BookingStatus;
import com.untamed.untamedbackend.model.ActivitySession;
import com.untamed.untamedbackend.model.ActivityTemplate;
import com.untamed.untamedbackend.model.RatingSummary;
import com.untamed.untamedbackend.model.Review;
import com.untamed.untamedbackend.model.ReviewStatus;
import com.untamed.untamedbackend.model.User;
import com.untamed.untamedbackend.repository.ActivitySessionRepository;
import com.untamed.untamedbackend.repository.ActivityTemplateRepository;
import com.untamed.untamedbackend.repository.ReviewRepository;
import com.untamed.untamedbackend.repository.UserRepository;
import com.untamed.untamedbackend.review.ReviewUserDto;
import com.untamed.untamedbackend.dto.PaginatedResponse;
import com.untamed.untamedbackend.service.LevelingService;
import com.untamed.untamedbackend.service.UserInsightService;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.util.List;
import java.util.Objects;

@Service
@RequiredArgsConstructor
public class ReviewService {

    private final ReviewRepository reviewRepository;
    private final BookingRepository bookingRepository;
    private final ActivitySessionRepository activitySessionRepository;
    private final ActivityTemplateRepository activityTemplateRepository;
    private final UserRepository userRepository;
    private final UserInsightService userInsightService;
    private final LevelingService levelingService;

    @Transactional
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
        Instant startAt = session.getStartAt();

        if (startAt == null || !startAt.isBefore(now)) {
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
            levelingService.recalculateUserLevel(saved.getReviewerId());
            incrementReviewsWrittenCount(currentUserId);
            userInsightService.onReviewCreated(saved);

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

    public PaginatedResponse<ReviewResponse> listVisibleReviewsForTemplatePage(String templateId, int page, int size) {
        Page<Review> reviewPage = reviewRepository.findByActivityTemplateIdAndStatus(
                templateId,
                ReviewStatus.VISIBLE,
                PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "createdAt"))
        );

        List<ReviewResponse> content = reviewPage.getContent()
                .stream()
                .map(this::toResponse)
                .toList();

        return PaginatedResponse.from(reviewPage, content);
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
        User reviewerUser = userRepository.findById(review.getReviewerId()).orElse(null);
        User guideUser = userRepository.findById(review.getGuideId()).orElse(null);

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
                .reviewer(toReviewUserDto(reviewerUser))
                .guide(toReviewUserDto(guideUser))
                .replyText(review.getReplyText())
                .replyCreatedAt(review.getReplyCreatedAt())
                .replyUpdatedAt(review.getReplyUpdatedAt())
                .createdAt(review.getCreatedAt())
                .updatedAt(review.getUpdatedAt())
                .build();
    }

    private ReviewUserDto toReviewUserDto(User user) {
        if (user == null) return null;

        return ReviewUserDto.builder()
                .id(user.getId())
                .username(user.getUsername())
                .role(user.getRole() != null ? user.getRole().name() : null)
                .profileImageUrl(user.getProfileImageUrl())
                .build();
    }

    public ReviewResponse createReviewForTemplate(String currentUserId, String templateId, CreateTemplateReviewRequest req) {
        ActivityTemplate template = activityTemplateRepository.findById(templateId)
                .orElseThrow(() -> new IllegalArgumentException("Activity template not found"));

        if (template.getGuideId().equals(currentUserId)) {
            throw new IllegalArgumentException("Guide cannot review their own activity");
        }

        if (reviewRepository.existsByReviewerIdAndActivityTemplateId(currentUserId, templateId)) {
            throw new IllegalArgumentException("You already reviewed this activity");
        }

        List<Booking> completedBookings = bookingRepository
                .findByUserIdAndStatusOrderByCreatedAtDesc(currentUserId, BookingStatus.COMPLETED);

        Instant now = Instant.now();

        Booking eligibleBooking = completedBookings.stream()
                .filter(b -> !b.isAttendanceMarkedAbsent())
                .map(b -> {
                    ActivitySession s = activitySessionRepository.findById(b.getSessionId()).orElse(null);
                    if (s == null) return null;
                    if (!templateId.equals(s.getTemplateId())) return null;
                    if (s.getStartAt() == null || !s.getStartAt().isBefore(now)) return null;
                    return b;
                })
                .filter(Objects::nonNull)
                .findFirst()
                .orElseThrow(() -> new IllegalArgumentException("No eligible completed booking found for this activity"));

        ActivitySession session = activitySessionRepository.findById(eligibleBooking.getSessionId())
                .orElseThrow(() -> new IllegalArgumentException("Session not found"));

        Review review = Review.builder()
                .activityTemplateId(templateId)
                .sessionId(session.getId())
                .bookingId(eligibleBooking.getId())
                .reviewerId(currentUserId)
                .guideId(template.getGuideId())
                .rating(req.getRating())
                .comment(req.getComment().trim())
                .status(ReviewStatus.VISIBLE)
                .build();

        Review saved;
        try {
            saved = reviewRepository.save(review);

            levelingService.recalculateUserLevel(saved.getReviewerId());
            incrementReviewsWrittenCount(currentUserId);
            userInsightService.onReviewCreated(saved);

        } catch (DuplicateKeyException e) {
            throw new IllegalArgumentException("You already reviewed this activity");
        }

        recomputeTemplateRating(templateId);
        return toResponse(saved);
    }

    public List<ReviewResponse> listMyReviews(String userId) {
        return reviewRepository.findByReviewerIdOrderByCreatedAtDesc(userId)
                .stream()
                .map(this::toResponse)
                .toList();
    }

    public PaginatedResponse<ReviewResponse> listMyReviewsPage(String userId, int page, int size) {
        Page<Review> reviewPage = reviewRepository.findByReviewerId(
                userId,
                PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "createdAt"))
        );

        List<ReviewResponse> content = reviewPage.getContent()
                .stream()
                .map(this::toResponse)
                .toList();

        return PaginatedResponse.from(reviewPage, content);
    }

    private void incrementReviewsWrittenCount(String userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));
        user.setReviewsWrittenCount(user.getReviewsWrittenCount() + 1);
        userRepository.save(user);
    }
}

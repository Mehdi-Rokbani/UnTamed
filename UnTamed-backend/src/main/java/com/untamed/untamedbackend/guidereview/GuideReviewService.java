package com.untamed.untamedbackend.guidereview;

import com.untamed.untamedbackend.booking.Booking;
import com.untamed.untamedbackend.booking.BookingRepository;
import com.untamed.untamedbackend.booking.BookingStatus;
import com.untamed.untamedbackend.dto.PaginatedResponse;
import com.untamed.untamedbackend.model.ActivitySession;
import com.untamed.untamedbackend.model.ActivityTemplate;
import com.untamed.untamedbackend.model.ReviewStatus;
import com.untamed.untamedbackend.model.Role;
import com.untamed.untamedbackend.model.User;
import com.untamed.untamedbackend.repository.ActivitySessionRepository;
import com.untamed.untamedbackend.repository.ActivityTemplateRepository;
import com.untamed.untamedbackend.repository.UserRepository;
import com.untamed.untamedbackend.service.LevelingService;
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

@Service
@RequiredArgsConstructor
public class GuideReviewService {

    private final GuideReviewRepository guideReviewRepository;
    private final BookingRepository bookingRepository;
    private final ActivitySessionRepository activitySessionRepository;
    private final ActivityTemplateRepository activityTemplateRepository;
    private final UserRepository userRepository;
    private final LevelingService levelingService;

    @Transactional
    public GuideReviewResponse createGuideReview(String reviewerId, String guideId, GuideReviewCreateRequest request) {
        User reviewer = requireUser(reviewerId);
        if (!isAdventurerRole(reviewer.getRole())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Only adventurers can review guides.");
        }

        User guide = requireGuide(guideId);
        if (reviewerId.equals(guideId)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "You cannot review yourself.");
        }

        EligibilityContext context = validateEligibility(reviewerId, guideId, request.bookingId());

        GuideReview review = GuideReview.builder()
                .guideId(guide.getId())
                .reviewerId(reviewer.getId())
                .bookingId(context.booking().getId())
                .sessionId(context.session().getId())
                .rating(request.rating())
                .comment(request.comment().trim())
                .status(ReviewStatus.VISIBLE)
                .build();

        GuideReview saved;
        try {
            saved = guideReviewRepository.save(review);
            levelingService.recalculateUserLevel(saved.getReviewerId());
        } catch (DuplicateKeyException e) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "You already reviewed this guide for this booking.");
        }

        recomputeGuideRatingSummary(guide.getId());
        return toResponse(saved);
    }

    public PaginatedResponse<GuideReviewResponse> listGuideReviews(String guideId, int page, int size) {
        requireGuide(guideId);

        Page<GuideReview> reviewPage = guideReviewRepository.findByGuideIdAndStatus(
                guideId,
                ReviewStatus.VISIBLE,
                PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "createdAt"))
        );

        List<GuideReviewResponse> content = reviewPage.getContent()
                .stream()
                .map(this::toResponse)
                .toList();

        return PaginatedResponse.from(reviewPage, content);
    }

    public GuideReviewEligibilityResponse getEligibility(String reviewerId, String guideId, String bookingId) {
        try {
            User reviewer = requireUser(reviewerId);
            if (!isAdventurerRole(reviewer.getRole())) {
                return new GuideReviewEligibilityResponse(false, false, null, "Only adventurers can review guides.");
            }

            requireGuide(guideId);
            if (reviewerId.equals(guideId)) {
                return new GuideReviewEligibilityResponse(false, false, null, "You cannot review yourself.");
            }

            validateEligibility(reviewerId, guideId, bookingId);
            return new GuideReviewEligibilityResponse(true, false, null, "Eligible to review this guide.");
        } catch (AlreadyReviewedException e) {
            return new GuideReviewEligibilityResponse(false, true, e.reviewId(), "You already reviewed this guide for this booking.");
        } catch (ResponseStatusException e) {
            return new GuideReviewEligibilityResponse(false, false, null, e.getReason());
        } catch (RuntimeException e) {
            return new GuideReviewEligibilityResponse(false, false, null, e.getMessage());
        }
    }

    private EligibilityContext validateEligibility(String reviewerId, String guideId, String bookingId) {
        if (bookingId == null || bookingId.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "bookingId is required.");
        }

        Booking booking = bookingRepository.findByIdAndUserId(bookingId, reviewerId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Booking not found."));

        if (booking.getStatus() != BookingStatus.COMPLETED) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Only completed bookings can be used for guide reviews.");
        }

        ActivitySession session = activitySessionRepository.findById(booking.getSessionId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Session not found."));

        if (!guideId.equals(session.getGuideId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "This booking was not guided by this guide.");
        }

        if (!isSessionInPast(session)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "You can review the guide only after the session has ended.");
        }

        ActivityTemplate template = activityTemplateRepository.findById(session.getTemplateId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Activity template not found."));

        if (!guideId.equals(template.getGuideId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "This guide does not own the booked activity.");
        }

        guideReviewRepository.findByReviewerIdAndGuideIdAndBookingId(reviewerId, guideId, booking.getId())
                .ifPresent(existing -> {
                    throw new AlreadyReviewedException(existing.getId());
                });

        return new EligibilityContext(booking, session, template);
    }

    private boolean isSessionInPast(ActivitySession session) {
        Instant now = Instant.now();
        Instant endAt = session.getEndAt();
        if (endAt != null) {
            return endAt.isBefore(now);
        }
        return session.getStartAt() != null && session.getStartAt().isBefore(now);
    }

    private User requireUser(String userId) {
        return userRepository.findById(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found."));
    }

    private User requireGuide(String guideId) {
        User guide = requireUser(guideId);
        if (guide.getRole() != Role.GUIDE) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Target user is not a guide.");
        }
        return guide;
    }

    private boolean isAdventurerRole(Role role) {
        return role == Role.ADVENTURER || role == Role.USER;
    }

    private void recomputeGuideRatingSummary(String guideId) {
        User guide = requireGuide(guideId);
        List<GuideReview> reviews = guideReviewRepository.findByGuideIdAndStatus(guideId, ReviewStatus.VISIBLE);

        int count = reviews.size();
        double average = 0.0;
        if (count > 0) {
            average = reviews.stream().mapToInt(GuideReview::getRating).average().orElse(0.0);
            average = Math.round(average * 10.0) / 10.0;
        }

        User.GuideProfile guideProfile = guide.getGuideProfile();
        if (guideProfile == null) {
            guideProfile = User.GuideProfile.builder().build();
            guide.setGuideProfile(guideProfile);
        }

        guideProfile.setRatingSummary(
                User.RatingSummary.builder()
                        .average(average)
                        .count(count)
                        .build()
        );

        userRepository.save(guide);
    }

    private GuideReviewResponse toResponse(GuideReview review) {
        User reviewer = userRepository.findById(review.getReviewerId()).orElse(null);

        return new GuideReviewResponse(
                review.getId(),
                review.getGuideId(),
                review.getReviewerId(),
                review.getBookingId(),
                review.getSessionId(),
                review.getRating(),
                review.getComment(),
                review.getStatus(),
                toReviewerSummary(reviewer),
                review.getCreatedAt(),
                review.getUpdatedAt()
        );
    }

    private GuideReviewResponse.ReviewerSummary toReviewerSummary(User reviewer) {
        if (reviewer == null) {
            return null;
        }

        return new GuideReviewResponse.ReviewerSummary(
                reviewer.getId(),
                reviewer.getUsername(),
                reviewer.getProfileImageUrl(),
                reviewer.getLevel()
        );
    }

    private record EligibilityContext(
            Booking booking,
            ActivitySession session,
            ActivityTemplate template
    ) {}

    private static class AlreadyReviewedException extends RuntimeException {
        private final String reviewId;

        private AlreadyReviewedException(String reviewId) {
            super("Already reviewed");
            this.reviewId = reviewId;
        }

        private String reviewId() {
            return reviewId;
        }
    }
}

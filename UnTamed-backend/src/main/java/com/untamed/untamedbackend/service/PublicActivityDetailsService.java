package com.untamed.untamedbackend.service;

import com.untamed.untamedbackend.booking.Booking;
import com.untamed.untamedbackend.booking.BookingRepository;
import com.untamed.untamedbackend.booking.BookingService;
import com.untamed.untamedbackend.booking.BookingStatus;
import com.untamed.untamedbackend.booking.ParticipantsPreviewResponse;
import com.untamed.untamedbackend.dto.PaginatedResponse;
import com.untamed.untamedbackend.dto.PublicActivityDetailsResponse;
import com.untamed.untamedbackend.dto.PublicActivityReviewStateDto;
import com.untamed.untamedbackend.dto.PublicSessionDto;
import com.untamed.untamedbackend.dto.PublicTemplateCardResponse;
import com.untamed.untamedbackend.dto.RatingSummaryDto;
import com.untamed.untamedbackend.model.ActivitySession;
import com.untamed.untamedbackend.model.ActivityTemplate;
import com.untamed.untamedbackend.model.Review;
import com.untamed.untamedbackend.recommendation.dto.RecommendationItemResponse;
import com.untamed.untamedbackend.recommendation.service.RecommendationService;
import com.untamed.untamedbackend.recommendation.service.SimilarActivityService;
import com.untamed.untamedbackend.repository.ActivitySessionRepository;
import com.untamed.untamedbackend.repository.ActivityTemplateRepository;
import com.untamed.untamedbackend.repository.ReviewRepository;
import com.untamed.untamedbackend.review.ReviewResponse;
import com.untamed.untamedbackend.review.ReviewService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class PublicActivityDetailsService {

    private static final int DEFAULT_SESSION_LIMIT = 10;
    private static final int DEFAULT_REVIEW_SIZE = 10;
    private static final int DEFAULT_RELATED_LIMIT = 6;

    private final ActivityTemplatePublicService publicTemplateService;
    private final ReviewService reviewService;
    private final SimilarActivityService similarActivityService;
    private final RecommendationService recommendationService;
    private final BookingService bookingService;
    private final BookingRepository bookingRepository;
    private final ActivitySessionRepository activitySessionRepository;
    private final ActivityTemplateRepository activityTemplateRepository;
    private final ReviewRepository reviewRepository;

    public PublicActivityDetailsResponse getDetails(String templateId, String userIdOrNull) {
        PublicTemplateCardResponse template = publicTemplateService.get(templateId);
        List<PublicSessionDto> upcomingSessions = publicTemplateService.listUpcomingSessions(templateId)
                .stream()
                .limit(DEFAULT_SESSION_LIMIT)
                .toList();

        PaginatedResponse<ReviewResponse> reviews =
                reviewService.listVisibleReviewsForTemplatePage(templateId, 0, DEFAULT_REVIEW_SIZE);

        ParticipantsPreviewResponse participantsPreview = upcomingSessions.isEmpty()
                ? null
                : safeParticipantsPreview(upcomingSessions.get(0).id());

        List<RecommendationItemResponse> similarActivities =
                similarActivityService.findSimilar(templateId, DEFAULT_RELATED_LIMIT)
                        .stream()
                        .filter(item -> !templateId.equals(item.getTemplateId()))
                        .limit(DEFAULT_RELATED_LIMIT)
                        .toList();

        List<RecommendationItemResponse> recommendations = userIdOrNull == null
                ? List.of()
                : recommendationService.getRecommendationsForUser(userIdOrNull, DEFAULT_RELATED_LIMIT)
                        .stream()
                        .filter(item -> !templateId.equals(item.getTemplateId()))
                        .limit(DEFAULT_RELATED_LIMIT)
                        .toList();

        return new PublicActivityDetailsResponse(
                template,
                upcomingSessions,
                template.rating() != null ? template.rating() : new RatingSummaryDto(0.0, 0),
                reviews,
                buildReviewState(templateId, userIdOrNull),
                participantsPreview,
                similarActivities,
                recommendations
        );
    }

    private ParticipantsPreviewResponse safeParticipantsPreview(String sessionId) {
        try {
            return bookingService.getParticipantsPreview(sessionId);
        } catch (RuntimeException ignored) {
            return null;
        }
    }

    private PublicActivityReviewStateDto buildReviewState(String templateId, String userIdOrNull) {
        if (userIdOrNull == null || userIdOrNull.isBlank()) {
            return new PublicActivityReviewStateDto(null, false, false, null, "Login required to review.");
        }

        Review existing = reviewRepository
                .findByReviewerIdAndActivityTemplateId(userIdOrNull, templateId)
                .orElse(null);

        ReviewResponse myReview = null;
        if (existing != null) {
            myReview = reviewService.getMyReviewForTemplate(userIdOrNull, templateId);
        }

        ActivityTemplate template = activityTemplateRepository.findById(templateId).orElse(null);
        if (template != null && userIdOrNull.equals(template.getGuideId())) {
            return new PublicActivityReviewStateDto(
                    myReview,
                    false,
                    existing != null,
                    existing != null ? existing.getId() : null,
                    "Guide cannot review their own activity."
            );
        }

        if (existing != null) {
            return new PublicActivityReviewStateDto(
                    myReview,
                    false,
                    true,
                    existing.getId(),
                    "You already reviewed this activity."
            );
        }

        ReviewEligibilityResult eligibility = computeEligibility(templateId, userIdOrNull);
        return new PublicActivityReviewStateDto(
                null,
                eligibility.eligible(),
                false,
                null,
                eligibility.reason()
        );
    }

    private ReviewEligibilityResult computeEligibility(String templateId, String userId) {
        List<Booking> completedBookings =
                bookingRepository.findByUserIdAndStatusOrderByCreatedAtDesc(userId, BookingStatus.COMPLETED);

        if (completedBookings.isEmpty()) {
            return new ReviewEligibilityResult(false, "Only completed bookings can be reviewed.");
        }

        Map<String, ActivitySession> sessionsById = activitySessionRepository
                .findAllById(completedBookings.stream()
                        .map(Booking::getSessionId)
                        .filter(Objects::nonNull)
                        .collect(Collectors.toSet()))
                .stream()
                .collect(Collectors.toMap(ActivitySession::getId, Function.identity()));

        Instant now = Instant.now();

        boolean hasTemplateBooking = false;
        for (Booking booking : completedBookings) {
            ActivitySession session = sessionsById.get(booking.getSessionId());
            if (session == null || !templateId.equals(session.getTemplateId())) {
                continue;
            }

            hasTemplateBooking = true;

            if (booking.isAttendanceMarkedAbsent()) {
                continue;
            }

            if (session.getStartAt() != null && session.getStartAt().isBefore(now)) {
                return new ReviewEligibilityResult(true, "Eligible to review.");
            }
        }

        if (!hasTemplateBooking) {
            return new ReviewEligibilityResult(false, "Complete a booking before leaving a review.");
        }

        return new ReviewEligibilityResult(false, "You can review only after attending the activity.");
    }

    private record ReviewEligibilityResult(boolean eligible, String reason) {}
}

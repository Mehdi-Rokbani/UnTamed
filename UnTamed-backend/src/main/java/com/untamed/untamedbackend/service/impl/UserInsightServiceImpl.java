package com.untamed.untamedbackend.service.impl;

import com.untamed.untamedbackend.model.ActivitySession;
import com.untamed.untamedbackend.model.ActivityTemplate;
import com.untamed.untamedbackend.booking.Booking;
import com.untamed.untamedbackend.booking.BookingStatus;
import com.untamed.untamedbackend.model.Review;
import com.untamed.untamedbackend.model.User;
import com.untamed.untamedbackend.model.UserInsight;
import com.untamed.untamedbackend.recommendation.n8n.N8nWebhookService;
import com.untamed.untamedbackend.repository.ActivitySessionRepository;
import com.untamed.untamedbackend.repository.ActivityTemplateRepository;
import com.untamed.untamedbackend.booking.BookingRepository;
import com.untamed.untamedbackend.repository.ReviewRepository;
import com.untamed.untamedbackend.repository.UserInsightRepository;
import com.untamed.untamedbackend.service.UserInsightService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class UserInsightServiceImpl implements UserInsightService {

    private final UserInsightRepository userInsightRepository;
    private final BookingRepository bookingRepository;
    private final ReviewRepository reviewRepository;
    private final ActivitySessionRepository activitySessionRepository;
    private final ActivityTemplateRepository activityTemplateRepository;
    private final N8nWebhookService n8nWebhookService;

    @Override
    public UserInsight save(UserInsight insight) {
        if (insight == null) {
            throw new IllegalArgumentException("UserInsight cannot be null");
        }

        insight.setUpdatedAt(Instant.now());
        return userInsightRepository.save(insight);
    }

    @Override
    public UserInsight getOrCreate(String userId) {
        return userInsightRepository.findByUserId(userId)
                .orElseGet(() -> userInsightRepository.save(
                        UserInsight.builder()
                                .userId(userId)
                                .totalBookings(0)
                                .confirmedBookings(0)
                                .completedTrips(0)
                                .cancelledBookings(0)
                                .reviewsWrittenCount(0)
                                .topCategoryIds(new ArrayList<>())
                                .categoryScores(new HashMap<>())
                                .difficultyScores(new HashMap<>())
                                .priceRangeScores(new HashMap<>())
                                .governorateScores(new HashMap<>())
                                .avgBookedPrice(BigDecimal.ZERO)
                                .minBookedPrice(BigDecimal.ZERO)
                                .maxBookedPrice(BigDecimal.ZERO)
                                .updatedAt(Instant.now())
                                .build()
                ));
    }

    @Override
    public UserInsight getByUserId(String userId) {
        return getOrCreate(userId);
    }

    @Override
    public void onBookingCreated(Booking booking) {
        if (booking == null || booking.getUserId() == null) return;

        UserInsight insight = getOrCreate(booking.getUserId());

        insight.setTotalBookings(insight.getTotalBookings() + 1);
        insight.setLastBookingAt(resolveBookingCreatedAt(booking));

        applyBookingSignal(insight, booking, 1);

        finalizeInsight(insight);
        userInsightRepository.save(insight);
    }

    @Override
    public void onBookingConfirmed(Booking booking) {
        if (booking == null || booking.getUserId() == null) return;

        UserInsight insight = getOrCreate(booking.getUserId());

        insight.setConfirmedBookings(insight.getConfirmedBookings() + 1);
        insight.setLastBookingAt(resolveBookingCreatedAt(booking));

        applyBookingSignal(insight, booking, 3);

        finalizeInsight(insight);
        userInsightRepository.save(insight);
    }

    @Override
    public void onBookingCompleted(Booking booking) {
        if (booking == null || booking.getUserId() == null) return;
        if (Boolean.TRUE.equals(booking.isAttendanceMarkedAbsent())) return;

        UserInsight insight = getOrCreate(booking.getUserId());

        insight.setCompletedTrips(insight.getCompletedTrips() + 1);
        insight.setLastCompletedTripAt(Instant.now());

        applyBookingSignal(insight, booking, 5);

        finalizeInsight(insight);
        userInsightRepository.save(insight);

        triggerUserEmbeddingSafely(booking.getUserId());
    }

    @Override
    public void onBookingCancelled(Booking booking) {
        if (booking == null || booking.getUserId() == null) return;

        UserInsight insight = getOrCreate(booking.getUserId());
        insight.setCancelledBookings(insight.getCancelledBookings() + 1);

        finalizeInsight(insight);
        userInsightRepository.save(insight);

        // usually not worth retriggering user embedding for cancellation noise
    }

    @Override
    public void onReviewCreated(Review review) {
        if (review == null || review.getReviewerId() == null) return;
        UserInsight insight = getOrCreate(review.getReviewerId());

        insight.setReviewsWrittenCount(insight.getReviewsWrittenCount() + 1);
        insight.setLastReviewAt(resolveReviewCreatedAt(review));

        int rating = review.getRating();
        int reviewWeight = switch (rating) {
            case 5 -> 5;
            case 4 -> 4;
            case 3 -> 2;
            case 2 -> 0;
            case 1 -> -1;
            default -> 0;
        };

        if (reviewWeight != 0) {
            resolveTemplateFromReview(review).ifPresent(template -> {
                applyTemplateSignal(insight, template, reviewWeight);
                updatePriceStats(insight, template.getPrice());
            });
        }

        finalizeInsight(insight);
        userInsightRepository.save(insight);

        triggerUserEmbeddingSafely(review.getReviewerId());
    }

    @Override
    public void onProfileUpdated(User user) {
        if (user == null || user.getId() == null) return;

        UserInsight insight = getOrCreate(user.getId());

        List<String> preferences = normalizeStringList(user.getPreferences());
        for (String categoryId : preferences) {
            incrementMap(insight.getCategoryScores(), categoryId, 2);
        }

        if (user.getLevel() != null ) {
            incrementMap(insight.getDifficultyScores(), user.getLevel().name(), 1);
        }

        finalizeInsight(insight);
        userInsightRepository.save(insight);

        triggerUserEmbeddingSafely(user.getId());
    }

    @Override
    public UserInsight rebuildForUser(String userId) {
        UserInsight insight = getOrCreate(userId);

        resetInsight(insight);

        List<Booking> bookings = bookingRepository.findByUserId(userId);
        for (Booking booking : bookings) {
            rebuildFromBooking(insight, booking);
        }

        List<Review> reviews = reviewRepository.findByReviewerIdOrderByCreatedAtDesc(userId);
        for (Review review : reviews) {
            rebuildFromReview(insight, review);
        }

        finalizeInsight(insight);
        UserInsight saved = userInsightRepository.save(insight);

        triggerUserEmbeddingSafely(userId);

        return saved;
    }

    private void rebuildFromBooking(UserInsight insight, Booking booking) {
        insight.setTotalBookings(insight.getTotalBookings() + 1);

        Instant bookingCreatedAt = resolveBookingCreatedAt(booking);
        if (bookingCreatedAt != null) {
            if (insight.getLastBookingAt() == null || bookingCreatedAt.isAfter(insight.getLastBookingAt())) {
                insight.setLastBookingAt(bookingCreatedAt);
            }
        }

        if (booking.getStatus() == BookingStatus.COMPLETED && !Boolean.TRUE.equals(booking.isAttendanceMarkedAbsent())) {
            insight.setCompletedTrips(insight.getCompletedTrips() + 1);
            applyBookingSignal(insight, booking, 5);

            Instant completedAt = resolveCompletedAtFromSession(booking);
            if (completedAt != null) {
                if (insight.getLastCompletedTripAt() == null || completedAt.isAfter(insight.getLastCompletedTripAt())) {
                    insight.setLastCompletedTripAt(completedAt);
                }
            }
        }

        if (booking.getStatus() == BookingStatus.CANCELLED) {
            insight.setCancelledBookings(insight.getCancelledBookings() + 1);
        }

        if (booking.getStatus() == BookingStatus.PENDING) {
            applyBookingSignal(insight, booking, 1);
        }
    }

    private void rebuildFromReview(UserInsight insight, Review review) {
        insight.setReviewsWrittenCount(insight.getReviewsWrittenCount() + 1);

        Instant reviewCreatedAt = resolveReviewCreatedAt(review);
        if (reviewCreatedAt != null) {
            if (insight.getLastReviewAt() == null || reviewCreatedAt.isAfter(insight.getLastReviewAt())) {
                insight.setLastReviewAt(reviewCreatedAt);
            }
        }

        int rating = review.getRating();
        int reviewWeight = switch (rating) {
            case 5 -> 5;
            case 4 -> 4;
            case 3 -> 2;
            case 2 -> 0;
            case 1 -> -1;
            default -> 0;
        };

        if (reviewWeight != 0) {
            resolveTemplateFromReview(review).ifPresent(template -> {
                applyTemplateSignal(insight, template, reviewWeight);
                updatePriceStats(insight, template.getPrice());
            });
        }
    }

    private void applyBookingSignal(UserInsight insight, Booking booking, int weight) {
        resolveTemplateFromBooking(booking).ifPresent(template -> {
            applyTemplateSignal(insight, template, weight);
            updatePriceStats(insight, template.getPrice());
        });
    }

    private void applyTemplateSignal(UserInsight insight, ActivityTemplate template, int weight) {
        if (template == null || weight == 0) return;

        for (String categoryId : normalizeStringList(template.getCategoryIds())) {
            incrementMap(insight.getCategoryScores(), categoryId, weight);
        }

        if (template.getDifficulty() != null) {
            incrementMap(insight.getDifficultyScores(), template.getDifficulty().name(), weight);
        }

        incrementMap(insight.getPriceRangeScores(), toPriceBucket(template.getPrice()), weight);
    }

    private Optional<ActivityTemplate> resolveTemplateFromBooking(Booking booking) {
        if (booking.getSessionId() == null) return Optional.empty();

        return activitySessionRepository.findById(booking.getSessionId())
                .flatMap(session -> {
                    if (session.getTemplateId() == null) return Optional.empty();
                    return activityTemplateRepository.findById(session.getTemplateId());
                });
    }

    private Optional<ActivityTemplate> resolveTemplateFromReview(Review review) {
        if (review == null) return Optional.empty();

        if (review.getActivityTemplateId() != null && !review.getActivityTemplateId().isBlank()) {
            return activityTemplateRepository.findById(review.getActivityTemplateId());
        }

        if (review.getBookingId() != null && !review.getBookingId().isBlank()) {
            return bookingRepository.findById(review.getBookingId())
                    .flatMap(this::resolveTemplateFromBooking);
        }

        return Optional.empty();
    }

    private Instant resolveCompletedAtFromSession(Booking booking) {
        if (booking == null || booking.getSessionId() == null) return null;

        Optional<ActivitySession> sessionOpt = activitySessionRepository.findById(booking.getSessionId());
        return sessionOpt.map(ActivitySession::getDate).orElse(null);
    }

    private Instant resolveBookingCreatedAt(Booking booking) {
        try {
            return booking.getCreatedAt();
        } catch (Exception e) {
            return Instant.now();
        }
    }

    private Instant resolveReviewCreatedAt(Review review) {
        try {
            return review.getCreatedAt();
        } catch (Exception e) {
            return Instant.now();
        }
    }

    private void updatePriceStats(UserInsight insight, BigDecimal price) {
        if (price == null) return;

        if (insight.getMinBookedPrice() == null || insight.getMinBookedPrice().compareTo(BigDecimal.ZERO) == 0) {
            insight.setMinBookedPrice(price);
        } else if (price.compareTo(insight.getMinBookedPrice()) < 0) {
            insight.setMinBookedPrice(price);
        }

        if (insight.getMaxBookedPrice() == null || price.compareTo(insight.getMaxBookedPrice()) > 0) {
            insight.setMaxBookedPrice(price);
        }

        BigDecimal currentAvg = insight.getAvgBookedPrice() == null ? BigDecimal.ZERO : insight.getAvgBookedPrice();
        int countBase = Math.max(insight.getConfirmedBookings() + insight.getCompletedTrips(), 1);

        BigDecimal newAvg = currentAvg.multiply(BigDecimal.valueOf(Math.max(countBase - 1, 0)))
                .add(price)
                .divide(BigDecimal.valueOf(countBase), 2, RoundingMode.HALF_UP);

        insight.setAvgBookedPrice(newAvg);
    }

    private String toPriceBucket(BigDecimal price) {
        if (price == null) return "UNKNOWN";
        if (price.compareTo(BigDecimal.valueOf(50)) <= 0) return "BUDGET";
        if (price.compareTo(BigDecimal.valueOf(150)) <= 0) return "MID";
        return "PREMIUM";
    }

    private void incrementMap(Map<String, Integer> map, String key, int delta) {
        if (map == null || key == null || key.isBlank() || delta == 0) return;
        map.put(key, map.getOrDefault(key, 0) + delta);
    }

    private List<String> normalizeStringList(List<String> values) {
        if (values == null) return Collections.emptyList();

        return values.stream()
                .filter(Objects::nonNull)
                .map(String::trim)
                .filter(v -> !v.isBlank())
                .distinct()
                .collect(Collectors.toList());
    }

    private void finalizeInsight(UserInsight insight) {
        insight.setTopCategoryIds(
                insight.getCategoryScores().entrySet().stream()
                        .sorted((a, b) -> Integer.compare(b.getValue(), a.getValue()))
                        .limit(5)
                        .map(Map.Entry::getKey)
                        .collect(Collectors.toList())
        );

        if (insight.getAvgBookedPrice() == null) {
            insight.setAvgBookedPrice(BigDecimal.ZERO);
        }
        if (insight.getMinBookedPrice() == null) {
            insight.setMinBookedPrice(BigDecimal.ZERO);
        }
        if (insight.getMaxBookedPrice() == null) {
            insight.setMaxBookedPrice(BigDecimal.ZERO);
        }

        if (insight.getCategoryScores() == null) insight.setCategoryScores(new HashMap<>());
        if (insight.getDifficultyScores() == null) insight.setDifficultyScores(new HashMap<>());
        if (insight.getPriceRangeScores() == null) insight.setPriceRangeScores(new HashMap<>());
        if (insight.getGovernorateScores() == null) insight.setGovernorateScores(new HashMap<>());
        if (insight.getTopCategoryIds() == null) insight.setTopCategoryIds(new ArrayList<>());

        insight.setUpdatedAt(Instant.now());
    }

    private void resetInsight(UserInsight insight) {
        insight.setTotalBookings(0);
        insight.setConfirmedBookings(0);
        insight.setCompletedTrips(0);
        insight.setCancelledBookings(0);
        insight.setReviewsWrittenCount(0);

        insight.setCategoryScores(new HashMap<>());
        insight.setDifficultyScores(new HashMap<>());
        insight.setPriceRangeScores(new HashMap<>());
        insight.setGovernorateScores(new HashMap<>());
        insight.setTopCategoryIds(new ArrayList<>());

        insight.setAvgBookedPrice(BigDecimal.ZERO);
        insight.setMinBookedPrice(BigDecimal.ZERO);
        insight.setMaxBookedPrice(BigDecimal.ZERO);

        insight.setLastBookingAt(null);
        insight.setLastCompletedTripAt(null);
        insight.setLastReviewAt(null);
        insight.setUpdatedAt(Instant.now());
    }

    private void triggerUserEmbeddingSafely(String userId) {
        if (userId == null || userId.isBlank()) {
            return;
        }

        try {
            n8nWebhookService.triggerUserEmbedding(userId);
        } catch (Exception e) {
            System.out.println("user embedding trigger failed: " + e.getMessage());
        }
    }
}
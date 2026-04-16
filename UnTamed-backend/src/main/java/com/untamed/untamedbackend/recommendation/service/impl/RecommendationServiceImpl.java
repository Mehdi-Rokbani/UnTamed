package com.untamed.untamedbackend.recommendation.service.impl;

import com.untamed.untamedbackend.booking.Booking;
import com.untamed.untamedbackend.booking.BookingRepository;
import com.untamed.untamedbackend.booking.BookingStatus;
import com.untamed.untamedbackend.model.ActivitySession;
import com.untamed.untamedbackend.model.ActivityStatus;
import com.untamed.untamedbackend.model.ActivityTemplate;
import com.untamed.untamedbackend.model.UserInsight;
import com.untamed.untamedbackend.recommendation.dto.RecommendationItemResponse;
import com.untamed.untamedbackend.recommendation.service.RecommendationService;
import com.untamed.untamedbackend.recommendation.util.VectorUtils;
import com.untamed.untamedbackend.repository.ActivitySessionRepository;
import com.untamed.untamedbackend.repository.ActivityTemplateRepository;
import com.untamed.untamedbackend.service.UserInsightService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.Duration;
import java.time.Instant;
import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class RecommendationServiceImpl implements RecommendationService {

    private static final double SEMANTIC_WEIGHT = 0.40;
    private static final double CATEGORY_WEIGHT = 0.20;
    private static final double DIFFICULTY_WEIGHT = 0.12;
    private static final double BUDGET_WEIGHT = 0.12;
    private static final double RATING_WEIGHT = 0.10;
    private static final double FRESHNESS_WEIGHT = 0.06;

    private static final double FALLBACK_CATEGORY_WEIGHT = 0.34;
    private static final double FALLBACK_DIFFICULTY_WEIGHT = 0.22;
    private static final double FALLBACK_BUDGET_WEIGHT = 0.20;
    private static final double FALLBACK_RATING_WEIGHT = 0.14;
    private static final double FALLBACK_FRESHNESS_WEIGHT = 0.10;

    private static final Set<BookingStatus> SEAT_CONSUMING_STATUSES =
            EnumSet.of(BookingStatus.PENDING, BookingStatus.PAYING, BookingStatus.COMPLETED);

    private static final int MIN_USEFUL_SEATS_LEFT = 2;

    private final UserInsightService userInsightService;
    private final ActivityTemplateRepository activityTemplateRepository;
    private final ActivitySessionRepository activitySessionRepository;
    private final BookingRepository bookingRepository;

    @Override
    public List<RecommendationItemResponse> getRecommendationsForUser(String userId, int limit) {
        UserInsight insight = userInsightService.getByUserId(userId);
        Map<String, Integer> categoryHistory = buildUserCategoryHistory(userId);

        List<Double> userVector = insight.getEmbeddingVector();
        boolean hasUserVector = userVector != null && !userVector.isEmpty();

        List<ActivityTemplate> templates = activityTemplateRepository.findAll();
        Set<String> bookedTemplateIds = resolveBookedTemplateIds(userId);
        Map<String, Integer> reservedSeatsBySessionId = buildReservedSeatsBySessionId();
        Instant now = Instant.now();

        return templates.stream()
                .filter(Objects::nonNull)
                .filter(template -> template.getId() != null)
                .filter(template -> !isOwnedByCurrentGuide(template, userId))
                .filter(template -> !bookedTemplateIds.contains(template.getId()))
                .map(template -> toRecommendation(
                        template,
                        insight,
                        userVector,
                        hasUserVector,
                        categoryHistory,
                        now,
                        reservedSeatsBySessionId
                ))
                .filter(Objects::nonNull)
                .sorted(Comparator.comparingDouble(RecommendationItemResponse::getScore).reversed())
                .limit(Math.max(1, limit))
                .toList();
    }

    private RecommendationItemResponse toRecommendation(
            ActivityTemplate template,
            UserInsight insight,
            List<Double> userVector,
            boolean hasUserVector,
            Map<String, Integer> categoryHistory,
            Instant now,
            Map<String, Integer> reservedSeatsBySessionId
    ) {
        Instant nextSessionDate = resolveNextUsefulSessionDate(template.getId(), now, reservedSeatsBySessionId);
        if (nextSessionDate == null) {
            return null;
        }

        List<Double> templateVector = template.getEmbeddingVector();
        boolean hasTemplateVector = templateVector != null && !templateVector.isEmpty();

        double categoryBonus = computeCategoryBonus(template.getCategoryIds(), categoryHistory);
        double difficultyBonus = computeDifficultyBonus(template, insight);
        double budgetBonus = computeBudgetBonus(template, insight);
        double ratingBonus = computeRatingBonus(template);
        double freshnessBonus = computeAvailabilityScore(nextSessionDate, now);

        double semanticScore = 0.0;
        boolean semanticUsed = hasUserVector && hasTemplateVector;

        double finalScore;
        if (semanticUsed) {
            double cosine = VectorUtils.cosineSimilarity(userVector, templateVector);
            semanticScore = clamp01((cosine + 1.0) / 2.0);

            finalScore =
                    (semanticScore * SEMANTIC_WEIGHT) +
                            (categoryBonus * CATEGORY_WEIGHT) +
                            (difficultyBonus * DIFFICULTY_WEIGHT) +
                            (budgetBonus * BUDGET_WEIGHT) +
                            (ratingBonus * RATING_WEIGHT) +
                            (freshnessBonus * FRESHNESS_WEIGHT);
        } else {
            finalScore =
                    (categoryBonus * FALLBACK_CATEGORY_WEIGHT) +
                            (difficultyBonus * FALLBACK_DIFFICULTY_WEIGHT) +
                            (budgetBonus * FALLBACK_BUDGET_WEIGHT) +
                            (ratingBonus * FALLBACK_RATING_WEIGHT) +
                            (freshnessBonus * FALLBACK_FRESHNESS_WEIGHT);
        }

        List<String> reasons = buildReasons(
                template,
                insight,
                semanticScore,
                semanticUsed,
                categoryBonus,
                difficultyBonus,
                budgetBonus,
                ratingBonus,
                freshnessBonus,
                hasUserVector,
                hasTemplateVector
        );

        double ratingAverage = template.getRating() != null ? template.getRating().getAverage() : 0.0;
        int ratingCount = template.getRating() != null ? template.getRating().getCount() : 0;

        return RecommendationItemResponse.builder()
                .templateId(template.getId())
                .title(template.getTitle())
                .description(template.getDescription())
                .coverImageUrl(resolveCoverImage(template))
                .categoryIds(template.getCategoryIds())
                .difficulty(template.getDifficulty() != null ? template.getDifficulty().name() : null)
                .price(template.getPrice())
                .ratingAverage(ratingAverage)
                .ratingCount(ratingCount)
                .nextSessionDate(nextSessionDate)
                .score(round(finalScore))
                .reasons(reasons)
                .build();
    }

    private double computeCategoryBonus(List<String> templateCategoryIds, Map<String, Integer> categoryHistory) {
        if (templateCategoryIds == null || templateCategoryIds.isEmpty() || categoryHistory == null || categoryHistory.isEmpty()) {
            return 0.0;
        }

        int total = categoryHistory.values().stream().mapToInt(Integer::intValue).sum();
        if (total <= 0) {
            return 0.0;
        }

        int matchedScore = templateCategoryIds.stream()
                .mapToInt(catId -> categoryHistory.getOrDefault(catId, 0))
                .sum();

        return clamp01((double) matchedScore / total);
    }

    private double computeDifficultyBonus(ActivityTemplate template, UserInsight insight) {
        if (template == null || template.getDifficulty() == null || insight == null || insight.getDifficultyScores() == null) {
            return 0.0;
        }

        Map<String, Integer> difficultyScores = insight.getDifficultyScores();
        if (difficultyScores.isEmpty()) {
            return 0.0;
        }

        int total = difficultyScores.values().stream().mapToInt(Integer::intValue).sum();
        if (total <= 0) {
            return 0.0;
        }

        int matched = difficultyScores.getOrDefault(template.getDifficulty().name(), 0);
        return clamp01((double) matched / total);
    }

    private double computeBudgetBonus(ActivityTemplate template, UserInsight insight) {
        if (template == null || template.getPrice() == null || insight == null) {
            return 0.0;
        }

        BigDecimal avg = insight.getAvgBookedPrice();
        BigDecimal min = insight.getMinBookedPrice();
        BigDecimal max = insight.getMaxBookedPrice();

        if (avg == null || avg.compareTo(BigDecimal.ZERO) <= 0) {
            return computePriceBucketBonus(template, insight);
        }

        double price = template.getPrice().doubleValue();
        double avgValue = avg.doubleValue();

        if (avgValue <= 0) {
            return computePriceBucketBonus(template, insight);
        }

        double ratioDiff = Math.abs(price - avgValue) / avgValue;

        if (ratioDiff <= 0.15) return 1.0;
        if (ratioDiff <= 0.30) return 0.85;
        if (ratioDiff <= 0.50) return 0.65;

        if (min != null && max != null && min.compareTo(BigDecimal.ZERO) > 0 && max.compareTo(BigDecimal.ZERO) > 0) {
            double minValue = min.doubleValue();
            double maxValue = max.doubleValue();

            if (price >= minValue && price <= maxValue) return 0.8;
            if (price >= minValue * 0.85 && price <= maxValue * 1.15) return 0.6;
        }

        return computePriceBucketBonus(template, insight) * 0.6;
    }

    private double computePriceBucketBonus(ActivityTemplate template, UserInsight insight) {
        if (template == null || insight == null || insight.getPriceRangeScores() == null || template.getPrice() == null) {
            return 0.0;
        }

        Map<String, Integer> bucketScores = insight.getPriceRangeScores();
        if (bucketScores.isEmpty()) {
            return 0.0;
        }

        int total = bucketScores.values().stream().mapToInt(Integer::intValue).sum();
        if (total <= 0) {
            return 0.0;
        }

        String bucket = toPriceBucket(template.getPrice());
        int matched = bucketScores.getOrDefault(bucket, 0);

        return clamp01((double) matched / total);
    }

    private double computeRatingBonus(ActivityTemplate template) {
        if (template.getRating() == null) {
            return 0.0;
        }

        double ratingAverage = template.getRating().getAverage();
        int ratingCount = template.getRating().getCount();

        if (ratingCount <= 0) {
            return 0.0;
        }

        double normalizedRating = clamp01(ratingAverage / 5.0);
        double confidence = clamp01(ratingCount / 20.0);

        return normalizedRating * confidence;
    }

    private List<String> buildReasons(
            ActivityTemplate template,
            UserInsight insight,
            double semanticScore,
            boolean semanticUsed,
            double categoryBonus,
            double difficultyBonus,
            double budgetBonus,
            double ratingBonus,
            double freshnessBonus,
            boolean hasUserVector,
            boolean hasTemplateVector
    ) {
        List<String> reasons = new ArrayList<>();

        if (semanticUsed) {
            if (semanticScore >= 0.88) {
                reasons.add("Strong semantic match to your profile");
            } else if (semanticScore >= 0.72) {
                reasons.add("Good semantic match to your interests");
            }
        } else if (!hasUserVector) {
            reasons.add("Recommended from your booking history");
        } else if (!hasTemplateVector) {
            reasons.add("Recommended using behavioral signals");
        }

        if (categoryBonus >= 0.15) {
            reasons.add("Matches categories you often book");
        }

        if (difficultyBonus >= 0.25 && template.getDifficulty() != null) {
            reasons.add("Fits your preferred difficulty");
        }

        if (budgetBonus >= 0.70) {
            reasons.add("Very close to your usual budget");
        } else if (budgetBonus >= 0.40) {
            reasons.add("Close to your usual budget");
        }

        if (ratingBonus >= 0.65) {
            reasons.add("Highly rated by other users");
        }

        if (freshnessBonus >= 0.80) {
            reasons.add("Available soon");
        }

        if (reasons.isEmpty()) {
            reasons.add("Recommended based on your activity profile");
        }

        return reasons.stream().distinct().limit(3).toList();
    }

    private double computeAvailabilityScore(Instant nextSessionDate, Instant now) {
        long days = Math.max(0, Duration.between(now, nextSessionDate).toDays());

        if (days <= 3) return 1.0;
        if (days <= 7) return 0.85;
        if (days <= 14) return 0.65;
        if (days <= 30) return 0.45;
        return 0.25;
    }

    private Instant resolveNextUsefulSessionDate(
            String templateId,
            Instant now,
            Map<String, Integer> reservedSeatsBySessionId
    ) {
        return activitySessionRepository.findByTemplateIdOrderByStartAtAsc(templateId).stream()
                .filter(Objects::nonNull)
                .filter(session -> session.getStatus() == ActivityStatus.PUBLISHED)
                .filter(session -> session.getStartAt() != null && session.getStartAt().isAfter(now))
                .filter(session -> hasUsefulSeatsLeft(session, reservedSeatsBySessionId))
                .map(ActivitySession::getStartAt)
                .findFirst()
                .orElse(null);
    }

    private boolean hasUsefulSeatsLeft(ActivitySession session, Map<String, Integer> reservedSeatsBySessionId) {
        if (session == null || session.getId() == null) {
            return false;
        }

        int capacity = Math.max(session.getCapacity(), 0);
        int reserved = reservedSeatsBySessionId.getOrDefault(session.getId(), 0);
        int seatsLeft = Math.max(0, capacity - reserved);

        return seatsLeft >= MIN_USEFUL_SEATS_LEFT;
    }

    private Map<String, Integer> buildReservedSeatsBySessionId() {
        List<Booking> bookings = bookingRepository.findAll();
        if (bookings == null || bookings.isEmpty()) {
            return Collections.emptyMap();
        }

        Map<String, Integer> reservedSeatsBySessionId = new HashMap<>();

        for (Booking booking : bookings) {
            if (booking == null || booking.getSessionId() == null || booking.getStatus() == null) {
                continue;
            }

            if (!SEAT_CONSUMING_STATUSES.contains(booking.getStatus())) {
                continue;
            }

            reservedSeatsBySessionId.merge(
                    booking.getSessionId(),
                    Math.max(booking.getNumberOfPeople(), 0),
                    Integer::sum
            );
        }

        return reservedSeatsBySessionId;
    }

    private boolean isOwnedByCurrentGuide(ActivityTemplate template, String userId) {
        if (template == null || userId == null || userId.isBlank()) {
            return false;
        }

        return template.getGuideId() != null && template.getGuideId().equals(userId);
    }

    private Set<String> resolveBookedTemplateIds(String userId) {
        List<Booking> bookings = bookingRepository.findByUserId(userId);
        if (bookings == null || bookings.isEmpty()) {
            return Collections.emptySet();
        }

        return bookings.stream()
                .map(Booking::getSessionId)
                .filter(Objects::nonNull)
                .map(activitySessionRepository::findById)
                .filter(Optional::isPresent)
                .map(Optional::get)
                .map(ActivitySession::getTemplateId)
                .filter(Objects::nonNull)
                .collect(Collectors.toSet());
    }

    private Map<String, Integer> buildUserCategoryHistory(String userId) {
        List<Booking> bookings = bookingRepository.findByUserId(userId);
        if (bookings == null || bookings.isEmpty()) {
            return Collections.emptyMap();
        }

        Map<String, Integer> categoryCount = new HashMap<>();

        for (Booking booking : bookings) {
            if (!shouldCountForPreferenceLearning(booking)) {
                continue;
            }

            if (booking.getSessionId() == null) {
                continue;
            }

            Optional<ActivitySession> sessionOpt = activitySessionRepository.findById(booking.getSessionId());
            if (sessionOpt.isEmpty()) {
                continue;
            }

            ActivitySession session = sessionOpt.get();
            if (session.getTemplateId() == null) {
                continue;
            }

            Optional<ActivityTemplate> templateOpt = activityTemplateRepository.findById(session.getTemplateId());
            if (templateOpt.isEmpty()) {
                continue;
            }

            ActivityTemplate template = templateOpt.get();
            if (template.getCategoryIds() == null || template.getCategoryIds().isEmpty()) {
                continue;
            }

            for (String categoryId : template.getCategoryIds()) {
                if (categoryId != null && !categoryId.isBlank()) {
                    categoryCount.merge(categoryId, 1, Integer::sum);
                }
            }
        }

        return categoryCount;
    }

    private String resolveCoverImage(ActivityTemplate template) {
        if (template.getImages() != null
                && !template.getImages().isEmpty()
                && template.getImages().get(0) != null
                && template.getImages().get(0).getUrl() != null
                && !template.getImages().get(0).getUrl().isBlank()) {
            return template.getImages().get(0).getUrl();
        }

        return null;
    }

    private boolean shouldCountForPreferenceLearning(Booking booking) {
        if (booking == null || booking.getStatus() == null) {
            return false;
        }

        return switch (booking.getStatus()) {
            case COMPLETED -> true;
            default -> false;
        };
    }

    private String toPriceBucket(BigDecimal price) {
        if (price == null) return "UNKNOWN";
        if (price.compareTo(BigDecimal.valueOf(50)) <= 0) return "BUDGET";
        if (price.compareTo(BigDecimal.valueOf(150)) <= 0) return "MID";
        return "PREMIUM";
    }

    private double clamp01(double value) {
        return Math.max(0.0, Math.min(1.0, value));
    }

    private double round(double value) {
        return Math.round(value * 1000.0) / 1000.0;
    }
}
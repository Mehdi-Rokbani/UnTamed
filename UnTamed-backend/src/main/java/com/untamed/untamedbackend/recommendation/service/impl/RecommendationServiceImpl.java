package com.untamed.untamedbackend.recommendation.service.impl;

import com.untamed.untamedbackend.booking.Booking;
import com.untamed.untamedbackend.booking.BookingRepository;
import com.untamed.untamedbackend.booking.BookingStatus;
import com.untamed.untamedbackend.model.ActivitySession;
import com.untamed.untamedbackend.model.ActivityStatus;
import com.untamed.untamedbackend.model.ActivityTemplate;
import com.untamed.untamedbackend.model.UserInsight;
import com.untamed.untamedbackend.repository.ActivitySessionRepository;
import com.untamed.untamedbackend.repository.ActivityTemplateRepository;
import com.untamed.untamedbackend.recommendation.RecommendationScore;
import com.untamed.untamedbackend.recommendation.dto.RecommendationItemResponse;
import com.untamed.untamedbackend.recommendation.service.RecommendationService;
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

    private static final double CATEGORY_WEIGHT = 0.35;
    private static final double DIFFICULTY_WEIGHT = 0.20;
    private static final double PRICE_WEIGHT = 0.15;
    private static final double POPULARITY_WEIGHT = 0.15;
    private static final double AVAILABILITY_WEIGHT = 0.15;

    private static final double RULE_WEIGHT = 1.0;
    private static final double EMBEDDING_WEIGHT = 0.0;

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

        List<ActivityTemplate> templates = activityTemplateRepository.findAll();
        Set<String> bookedTemplateIds = resolveBookedTemplateIds(userId);
        Map<String, Integer> reservedSeatsBySessionId = buildReservedSeatsBySessionId();
        Instant now = Instant.now();

        return templates.stream()
                .filter(Objects::nonNull)
                .filter(template -> template.getId() != null)
                .filter(template -> !isOwnedByCurrentGuide(template, userId))
                .filter(template -> !bookedTemplateIds.contains(template.getId()))
                .map(template -> toScoredRecommendation(template, insight, categoryHistory, now, reservedSeatsBySessionId))
                .filter(Objects::nonNull)
                .sorted(Comparator.comparingDouble(RecommendationItemResponse::getScore).reversed())
                .limit(Math.max(1, limit))
                .toList();
    }

    private RecommendationItemResponse toScoredRecommendation(
            ActivityTemplate template,
            UserInsight insight,
            Map<String, Integer> categoryHistory,
            Instant now,
            Map<String, Integer> reservedSeatsBySessionId
    ) {
        Instant nextSessionDate = resolveNextUsefulSessionDate(template.getId(), now, reservedSeatsBySessionId);
        if (nextSessionDate == null) {
            return null;
        }

        double categoryScore = computeCategoryScore(template, insight, categoryHistory);
        double difficultyScore = computeDifficultyScore(template, insight);
        double priceScore = computePriceScore(template, insight);
        double popularityScore = computePopularityScore(template);
        double availabilityScore = computeAvailabilityScore(nextSessionDate, now);

        double ruleScore =
                CATEGORY_WEIGHT * categoryScore +
                        DIFFICULTY_WEIGHT * difficultyScore +
                        PRICE_WEIGHT * priceScore +
                        POPULARITY_WEIGHT * popularityScore +
                        AVAILABILITY_WEIGHT * availabilityScore;

        double embeddingScore = 0.0;

        double finalScore =
                RULE_WEIGHT * ruleScore +
                        EMBEDDING_WEIGHT * embeddingScore;

        RecommendationScore score = RecommendationScore.builder()
                .ruleScore(round(ruleScore))
                .embeddingScore(round(embeddingScore))
                .finalScore(round(finalScore))
                .build();

        List<String> reasons = buildReasons(
                categoryScore,
                difficultyScore,
                priceScore,
                popularityScore,
                availabilityScore
        );

        return RecommendationItemResponse.builder()
                .templateId(template.getId())
                .title(template.getTitle())
                .description(template.getDescription())
                .coverImageUrl(resolveCoverImage(template))
                .categoryIds(template.getCategoryIds())
                .difficulty(template.getDifficulty() != null ? template.getDifficulty().name() : null)
                .price(template.getPrice())
                .ratingAverage(template.getRating() != null ? template.getRating().getAverage() : 0.0)
                .ratingCount(template.getRating() != null ? template.getRating().getCount() : 0)
                .nextSessionDate(nextSessionDate)
                .score(score.getFinalScore())
                .reasons(reasons)
                .build();
    }

    private List<String> buildReasons(
            double categoryScore,
            double difficultyScore,
            double priceScore,
            double popularityScore,
            double availabilityScore
    ) {
        List<String> reasons = new ArrayList<>();

        if (categoryScore >= 0.4) reasons.add("Matches your favorite categories");
        if (difficultyScore >= 0.6) reasons.add("Fits your preferred difficulty");
        if (priceScore >= 0.6) reasons.add("Matches your usual budget");
        if (popularityScore >= 0.7) reasons.add("Popular with other users");
        if (availabilityScore >= 0.7) reasons.add("Has an upcoming session soon");

        return reasons.stream()
                .distinct()
                .limit(3)
                .toList();
    }

    private double computeCategoryScore(
            ActivityTemplate template,
            UserInsight insight,
            Map<String, Integer> categoryHistory
    ) {
        if (template.getCategoryIds() == null || template.getCategoryIds().isEmpty()) {
            return 0.0;
        }

        double insightScore = 0.0;
        if (insight != null && insight.getCategoryScores() != null && !insight.getCategoryScores().isEmpty()) {
            insightScore = template.getCategoryIds().stream()
                    .mapToDouble(categoryId -> insight.getCategoryScores().getOrDefault(categoryId, 0))
                    .sum();

            insightScore = insightScore / template.getCategoryIds().size();
        }

        double historyScore = 0.0;
        if (categoryHistory != null && !categoryHistory.isEmpty()) {
            int totalHistory = categoryHistory.values().stream()
                    .mapToInt(Integer::intValue)
                    .sum();

            if (totalHistory > 0) {
                historyScore = template.getCategoryIds().stream()
                        .mapToDouble(categoryId -> categoryHistory.getOrDefault(categoryId, 0))
                        .sum();

                historyScore = historyScore / totalHistory;
            }
        }

        double combined = (0.7 * insightScore) + (0.3 * historyScore);
        return clamp01(combined);
    }

    private double computeDifficultyScore(ActivityTemplate template, UserInsight insight) {
        if (template.getDifficulty() == null) return 0.0;
        if (insight == null || insight.getDifficultyScores() == null || insight.getDifficultyScores().isEmpty()) return 0.0;

        int raw = insight.getDifficultyScores().getOrDefault(template.getDifficulty().name(), 0);
        return clamp01(raw);
    }

    private double computePriceScore(ActivityTemplate template, UserInsight insight) {
        if (insight == null || insight.getPriceRangeScores() == null || insight.getPriceRangeScores().isEmpty()) return 0.0;

        String bucket = toPriceBucket(template.getPrice());
        int raw = insight.getPriceRangeScores().getOrDefault(bucket, 0);
        return clamp01(raw);
    }

    private double computePopularityScore(ActivityTemplate template) {
        if (template.getRating() == null) return 0.0;

        double avg = template.getRating().getAverage();
        int count = template.getRating().getCount();

        double ratingPart = clamp01(avg / 5.0);
        double volumePart = clamp01(count / 20.0);

        return (ratingPart * 0.7) + (volumePart * 0.3);
    }

    private double computeAvailabilityScore(Instant nextSessionDate, Instant now) {
        long days = Math.max(0, Duration.between(now, nextSessionDate).toDays());

        if (days <= 3) return 1.0;
        if (days <= 7) return 0.8;
        if (days <= 14) return 0.6;
        if (days <= 30) return 0.4;
        return 0.2;
    }

    private Instant resolveNextUsefulSessionDate(
            String templateId,
            Instant now,
            Map<String, Integer> reservedSeatsBySessionId
    ) {
        return activitySessionRepository.findByTemplateIdOrderByDateAsc(templateId).stream()
                .filter(Objects::nonNull)
                .filter(session -> session.getStatus() == ActivityStatus.PUBLISHED)
                .filter(session -> session.getDate() != null && session.getDate().isAfter(now))
                .filter(session -> hasUsefulSeatsLeft(session, reservedSeatsBySessionId))
                .map(ActivitySession::getDate)
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
        return Math.round(value * 100.0) / 100.0;
    }
}
package com.untamed.untamedbackend.recommendation.service.impl;

import com.untamed.untamedbackend.booking.Booking;
import com.untamed.untamedbackend.booking.BookingRepository;
import com.untamed.untamedbackend.booking.BookingStatus;
import com.untamed.untamedbackend.model.ActivitySession;
import com.untamed.untamedbackend.model.ActivityStatus;
import com.untamed.untamedbackend.model.ActivityTemplate;
import com.untamed.untamedbackend.model.User;
import com.untamed.untamedbackend.model.UserInsight;
import com.untamed.untamedbackend.recommendation.dto.RecommendationItemResponse;
import com.untamed.untamedbackend.recommendation.service.RecommendationService;
import com.untamed.untamedbackend.recommendation.util.VectorUtils;
import com.untamed.untamedbackend.repository.ActivitySessionRepository;
import com.untamed.untamedbackend.repository.ActivityTemplateRepository;
import com.untamed.untamedbackend.repository.UserRepository;
import com.untamed.untamedbackend.service.UserInsightService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.EnumSet;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class RecommendationServiceImpl implements RecommendationService {

    private static final double SEMANTIC_WEIGHT = 0.38;
    private static final double CATEGORY_WEIGHT = 0.20;
    private static final double DIFFICULTY_WEIGHT = 0.12;
    private static final double BUDGET_WEIGHT = 0.11;
    private static final double RATING_WEIGHT = 0.10;
    private static final double AVAILABILITY_WEIGHT = 0.09;

    private static final double FALLBACK_CATEGORY_WEIGHT = 0.28;
    private static final double FALLBACK_DIFFICULTY_WEIGHT = 0.20;
    private static final double FALLBACK_BUDGET_WEIGHT = 0.18;
    private static final double FALLBACK_RATING_WEIGHT = 0.18;
    private static final double FALLBACK_AVAILABILITY_WEIGHT = 0.16;

    private static final double EXPLICIT_PREFERENCE_BOOST = 0.08;
    private static final double EXPLORATION_BOOST = 0.045;
    private static final int MIN_USEFUL_SEATS_LEFT = 2;
    private static final int LITTLE_HISTORY_THRESHOLD = 2;
    private static final int MAX_PER_CATEGORY_SOFT = 2;
    private static final int MAX_PER_GUIDE_SOFT = 2;

    private static final String TYPE_PERSONALIZED = "PERSONALIZED";
    private static final String TYPE_COLD_START = "COLD_START";
    private static final String TYPE_POPULAR = "POPULAR";
    private static final String TYPE_AVAILABLE_SOON = "AVAILABLE_SOON";
    private static final String TYPE_EXPLORATION = "EXPLORATION";

    private static final Set<BookingStatus> SEAT_CONSUMING_STATUSES =
            EnumSet.of(BookingStatus.PENDING, BookingStatus.PAYING, BookingStatus.COMPLETED);

    private final UserInsightService userInsightService;
    private final ActivityTemplateRepository activityTemplateRepository;
    private final ActivitySessionRepository activitySessionRepository;
    private final BookingRepository bookingRepository;
    private final UserRepository userRepository;

    @Override
    public List<RecommendationItemResponse> getRecommendationsForUser(String userId, int limit) {
        int safeLimit = Math.max(1, limit);
        Instant now = Instant.now();

        UserInsight insight = userInsightService.getByUserId(userId);
        User user = userRepository.findById(userId).orElse(null);
        List<Booking> userBookings = safeBookings(bookingRepository.findByUserId(userId));
        List<ActivityTemplate> templates = activityTemplateRepository.findAll();
        Map<String, ActivityTemplate> templatesById = templates.stream()
                .filter(Objects::nonNull)
                .filter(template -> template.getId() != null)
                .collect(Collectors.toMap(ActivityTemplate::getId, template -> template, (a, b) -> a));

        Map<String, ActivitySession> sessionsById = activitySessionRepository.findAll().stream()
                .filter(Objects::nonNull)
                .filter(session -> session.getId() != null)
                .collect(Collectors.toMap(ActivitySession::getId, session -> session, (a, b) -> a));

        Set<String> bookedTemplateIds = resolveBookedTemplateIds(userBookings, sessionsById);
        Map<String, Integer> categoryHistory = buildUserCategoryHistory(userBookings, sessionsById, templatesById);
        Map<String, Integer> reservedSeatsBySessionId = buildReservedSeatsBySessionId();
        Map<String, ActivitySession> nextUsefulSessionByTemplateId =
                buildNextUsefulSessionByTemplateId(now, reservedSeatsBySessionId);

        boolean coldStart = isColdStart(insight, categoryHistory);
        List<Double> userVector = safeVector(insight.getEmbeddingVector());
        boolean hasUserVector = !userVector.isEmpty();

        List<ScoredRecommendation> scored = templates.stream()
                .filter(Objects::nonNull)
                .filter(template -> template.getId() != null)
                .filter(template -> !Boolean.TRUE.equals(template.isArchived()))
                .filter(template -> !isOwnedByCurrentGuide(template, userId))
                .filter(template -> !bookedTemplateIds.contains(template.getId()))
                .map(template -> scoreTemplate(
                        template,
                        nextUsefulSessionByTemplateId.get(template.getId()),
                        insight,
                        user,
                        userVector,
                        hasUserVector,
                        coldStart,
                        categoryHistory,
                        now
                ))
                .filter(Objects::nonNull)
                .sorted(Comparator.comparingDouble(ScoredRecommendation::score).reversed())
                .toList();

        return diversify(scored, safeLimit).stream()
                .map(ScoredRecommendation::response)
                .toList();
    }

    private ScoredRecommendation scoreTemplate(
            ActivityTemplate template,
            ActivitySession nextSession,
            UserInsight insight,
            User user,
            List<Double> userVector,
            boolean hasUserVector,
            boolean coldStart,
            Map<String, Integer> categoryHistory,
            Instant now
    ) {
        if (nextSession == null || nextSession.getStartAt() == null) {
            return null;
        }

        List<Double> templateVector = safeVector(template.getEmbeddingVector());
        boolean hasTemplateVector = !templateVector.isEmpty();

        double semanticScore = hasUserVector && hasTemplateVector
                ? clamp01((VectorUtils.cosineSimilarity(userVector, templateVector) + 1.0) / 2.0)
                : 0.0;
        double categoryScore = computeCategoryScore(template, categoryHistory, user);
        double difficultyScore = computeDifficultyScore(template, insight, user);
        double budgetScore = computeBudgetScore(template, insight);
        double ratingScore = computeRatingScore(template);
        double availabilityScore = computeAvailabilityScore(nextSession.getStartAt(), now);
        double preferenceBoost = computeExplicitPreferenceBoost(template, user);
        boolean exploration = !coldStart
                && categoryScore <= 0.05
                && hasRelatedPreferenceSignal(template, user, categoryHistory);

        double score;
        if (hasUserVector && hasTemplateVector && !coldStart) {
            score =
                    (semanticScore * SEMANTIC_WEIGHT) +
                            (categoryScore * CATEGORY_WEIGHT) +
                            (difficultyScore * DIFFICULTY_WEIGHT) +
                            (budgetScore * BUDGET_WEIGHT) +
                            (ratingScore * RATING_WEIGHT) +
                            (availabilityScore * AVAILABILITY_WEIGHT);
        } else {
            score =
                    (categoryScore * FALLBACK_CATEGORY_WEIGHT) +
                            (difficultyScore * FALLBACK_DIFFICULTY_WEIGHT) +
                            (budgetScore * FALLBACK_BUDGET_WEIGHT) +
                            (ratingScore * FALLBACK_RATING_WEIGHT) +
                            (availabilityScore * FALLBACK_AVAILABILITY_WEIGHT);
        }

        score += preferenceBoost;
        if (exploration) {
            score += EXPLORATION_BOOST;
        }

        String recommendationType = chooseRecommendationType(coldStart, exploration, ratingScore, availabilityScore);
        List<String> reasons = buildReasons(
                semanticScore,
                categoryScore,
                difficultyScore,
                budgetScore,
                ratingScore,
                availabilityScore,
                preferenceBoost,
                recommendationType
        );

        RecommendationItemResponse response = RecommendationItemResponse.builder()
                .templateId(template.getId())
                .title(template.getTitle())
                .description(template.getDescription())
                .coverImageUrl(resolveCoverImage(template))
                .categoryIds(safeList(template.getCategoryIds()))
                .difficulty(template.getDifficulty() != null ? template.getDifficulty().name() : null)
                .price(template.getPrice())
                .ratingAverage(template.getRating() != null ? template.getRating().getAverage() : 0.0)
                .ratingCount(template.getRating() != null ? template.getRating().getCount() : 0)
                .nextSessionDate(nextSession.getStartAt())
                .score(round(score))
                .reasons(reasons)
                .semanticScore(round(semanticScore))
                .categoryScore(round(categoryScore))
                .difficultyScore(round(difficultyScore))
                .budgetScore(round(budgetScore))
                .ratingScore(round(ratingScore))
                .availabilityScore(round(availabilityScore))
                .recommendationType(recommendationType)
                .build();

        return new ScoredRecommendation(template, response, score);
    }

    private List<ScoredRecommendation> diversify(List<ScoredRecommendation> scored, int limit) {
        List<ScoredRecommendation> selected = new ArrayList<>();
        Set<String> selectedTemplateIds = new HashSet<>();
        Map<String, Integer> categoryCounts = new HashMap<>();
        Map<String, Integer> guideCounts = new HashMap<>();

        for (ScoredRecommendation item : scored) {
            if (selected.size() >= limit) break;
            String primaryCategory = primaryCategory(item.template());
            String guideId = item.template().getGuideId();

            boolean overCategory = primaryCategory != null
                    && categoryCounts.getOrDefault(primaryCategory, 0) >= MAX_PER_CATEGORY_SOFT;
            boolean overGuide = guideId != null
                    && guideCounts.getOrDefault(guideId, 0) >= MAX_PER_GUIDE_SOFT;

            if (overCategory || overGuide) {
                continue;
            }

            addSelected(item, selected, selectedTemplateIds, categoryCounts, guideCounts);
        }

        for (ScoredRecommendation item : scored) {
            if (selected.size() >= limit) break;
            if (!selectedTemplateIds.contains(item.template().getId())) {
                addSelected(item, selected, selectedTemplateIds, categoryCounts, guideCounts);
            }
        }

        return selected;
    }

    private void addSelected(
            ScoredRecommendation item,
            List<ScoredRecommendation> selected,
            Set<String> selectedTemplateIds,
            Map<String, Integer> categoryCounts,
            Map<String, Integer> guideCounts
    ) {
        selected.add(item);
        selectedTemplateIds.add(item.template().getId());

        String primaryCategory = primaryCategory(item.template());
        if (primaryCategory != null) {
            categoryCounts.merge(primaryCategory, 1, Integer::sum);
        }
        if (item.template().getGuideId() != null) {
            guideCounts.merge(item.template().getGuideId(), 1, Integer::sum);
        }
    }

    private Map<String, ActivitySession> buildNextUsefulSessionByTemplateId(
            Instant now,
            Map<String, Integer> reservedSeatsBySessionId
    ) {
        Map<String, ActivitySession> result = new LinkedHashMap<>();

        activitySessionRepository.findByStatusAndStartAtAfter(ActivityStatus.PUBLISHED, now).stream()
                .filter(Objects::nonNull)
                .filter(session -> session.getTemplateId() != null)
                .filter(session -> hasUsefulSeatsLeft(session, reservedSeatsBySessionId))
                .sorted(Comparator.comparing(ActivitySession::getStartAt))
                .forEach(session -> result.putIfAbsent(session.getTemplateId(), session));

        return result;
    }

    private Map<String, Integer> buildReservedSeatsBySessionId() {
        List<Booking> bookings = safeBookings(bookingRepository.findAll());
        Map<String, Integer> reservedSeatsBySessionId = new HashMap<>();

        for (Booking booking : bookings) {
            if (booking.getSessionId() == null || booking.getStatus() == null) {
                continue;
            }
            if (SEAT_CONSUMING_STATUSES.contains(booking.getStatus())) {
                reservedSeatsBySessionId.merge(
                        booking.getSessionId(),
                        Math.max(booking.getNumberOfPeople(), 0),
                        Integer::sum
                );
            }
        }

        return reservedSeatsBySessionId;
    }

    private boolean hasUsefulSeatsLeft(ActivitySession session, Map<String, Integer> reservedSeatsBySessionId) {
        int capacity = Math.max(session.getCapacity(), 0);
        int reserved = reservedSeatsBySessionId.getOrDefault(session.getId(), 0);
        return Math.max(0, capacity - reserved) >= MIN_USEFUL_SEATS_LEFT;
    }

    private Set<String> resolveBookedTemplateIds(
            List<Booking> bookings,
            Map<String, ActivitySession> sessionsById
    ) {
        return bookings.stream()
                .map(Booking::getSessionId)
                .filter(Objects::nonNull)
                .map(sessionsById::get)
                .filter(Objects::nonNull)
                .map(ActivitySession::getTemplateId)
                .filter(Objects::nonNull)
                .collect(Collectors.toSet());
    }

    private Map<String, Integer> buildUserCategoryHistory(
            List<Booking> bookings,
            Map<String, ActivitySession> sessionsById,
            Map<String, ActivityTemplate> templatesById
    ) {
        Map<String, Integer> categoryCount = new HashMap<>();

        for (Booking booking : bookings) {
            if (!shouldCountForPreferenceLearning(booking) || booking.getSessionId() == null) {
                continue;
            }

            ActivitySession session = sessionsById.get(booking.getSessionId());
            ActivityTemplate template = session != null ? templatesById.get(session.getTemplateId()) : null;

            for (String categoryId : safeList(template != null ? template.getCategoryIds() : null)) {
                if (categoryId != null && !categoryId.isBlank()) {
                    categoryCount.merge(categoryId, 1, Integer::sum);
                }
            }
        }

        return categoryCount;
    }

    private boolean shouldCountForPreferenceLearning(Booking booking) {
        return booking != null && booking.getStatus() == BookingStatus.COMPLETED;
    }

    private boolean isColdStart(UserInsight insight, Map<String, Integer> categoryHistory) {
        boolean noEmbedding = safeVector(insight.getEmbeddingVector()).isEmpty();
        int completedTrips = insight.getCompletedTrips();
        return noEmbedding && completedTrips <= LITTLE_HISTORY_THRESHOLD && categoryHistory.isEmpty();
    }

    private double computeCategoryScore(ActivityTemplate template, Map<String, Integer> categoryHistory, User user) {
        Set<String> templateCategories = new HashSet<>(safeList(template.getCategoryIds()));
        if (templateCategories.isEmpty()) {
            return 0.0;
        }

        double historyScore = 0.0;
        if (categoryHistory != null && !categoryHistory.isEmpty()) {
            int total = categoryHistory.values().stream().mapToInt(Integer::intValue).sum();
            int matched = templateCategories.stream().mapToInt(category -> categoryHistory.getOrDefault(category, 0)).sum();
            historyScore = total > 0 ? clamp01((double) matched / total) : 0.0;
        }

        double preferenceScore = preferenceTokenOverlap(template, user) > 0.0 ? 0.72 : 0.0;
        return Math.max(historyScore, preferenceScore);
    }

    private double computeDifficultyScore(ActivityTemplate template, UserInsight insight, User user) {
        if (template.getDifficulty() == null) {
            return 0.0;
        }

        Map<String, Integer> difficultyScores = insight.getDifficultyScores();
        double learned = 0.0;
        if (difficultyScores != null && !difficultyScores.isEmpty()) {
            int total = difficultyScores.values().stream().mapToInt(Integer::intValue).sum();
            learned = total > 0
                    ? clamp01((double) difficultyScores.getOrDefault(template.getDifficulty().name(), 0) / total)
                    : 0.0;
        }

        double explicitLevel = user != null
                && user.getLevel() != null
                && template.getDifficulty().name().equalsIgnoreCase(user.getLevel().name())
                ? 0.88
                : 0.0;

        return Math.max(learned, explicitLevel);
    }

    private double computeBudgetScore(ActivityTemplate template, UserInsight insight) {
        if (template.getPrice() == null || insight == null) {
            return 0.0;
        }

        BigDecimal avg = insight.getAvgBookedPrice();
        BigDecimal min = insight.getMinBookedPrice();
        BigDecimal max = insight.getMaxBookedPrice();

        if (avg != null && avg.compareTo(BigDecimal.ZERO) > 0) {
            double price = template.getPrice().doubleValue();
            double avgValue = avg.doubleValue();
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
        }

        return computePriceBucketScore(template, insight);
    }

    private double computePriceBucketScore(ActivityTemplate template, UserInsight insight) {
        Map<String, Integer> bucketScores = insight.getPriceRangeScores();
        if (bucketScores == null || bucketScores.isEmpty() || template.getPrice() == null) {
            return 0.0;
        }

        int total = bucketScores.values().stream().mapToInt(Integer::intValue).sum();
        if (total <= 0) {
            return 0.0;
        }

        return clamp01((double) bucketScores.getOrDefault(toPriceBucket(template.getPrice()), 0) / total);
    }

    private double computeRatingScore(ActivityTemplate template) {
        if (template.getRating() == null || template.getRating().getCount() <= 0) {
            return 0.0;
        }

        double normalizedRating = clamp01(template.getRating().getAverage() / 5.0);
        double confidence = clamp01(template.getRating().getCount() / 20.0);
        return normalizedRating * confidence;
    }

    private double computeAvailabilityScore(Instant nextSessionDate, Instant now) {
        long days = Math.max(0, Duration.between(now, nextSessionDate).toDays());

        if (days <= 3) return 1.0;
        if (days <= 7) return 0.85;
        if (days <= 14) return 0.65;
        if (days <= 30) return 0.45;
        return 0.25;
    }

    private double computeExplicitPreferenceBoost(ActivityTemplate template, User user) {
        return preferenceTokenOverlap(template, user) > 0.0 ? EXPLICIT_PREFERENCE_BOOST : 0.0;
    }

    private boolean hasRelatedPreferenceSignal(
            ActivityTemplate template,
            User user,
            Map<String, Integer> categoryHistory
    ) {
        return preferenceTokenOverlap(template, user) > 0.0
                || !safeList(template.getSemanticHints()).isEmpty()
                || (categoryHistory != null && !categoryHistory.isEmpty());
    }

    private double preferenceTokenOverlap(ActivityTemplate template, User user) {
        if (user == null || user.getPreferences() == null || user.getPreferences().isEmpty()) {
            return 0.0;
        }

        String blob = String.join(" ", safeList(template.getTags())) + " "
                + String.join(" ", safeList(template.getSemanticHints())) + " "
                + nullToEmpty(template.getTitle()) + " "
                + nullToEmpty(template.getDescription());
        String normalizedBlob = blob.toLowerCase(Locale.ROOT);

        long matches = user.getPreferences().stream()
                .filter(Objects::nonNull)
                .map(value -> value.trim().toLowerCase(Locale.ROOT))
                .filter(value -> !value.isBlank())
                .filter(normalizedBlob::contains)
                .count();

        return matches > 0 ? clamp01((double) matches / user.getPreferences().size()) : 0.0;
    }

    private String chooseRecommendationType(
            boolean coldStart,
            boolean exploration,
            double ratingScore,
            double availabilityScore
    ) {
        if (coldStart) return TYPE_COLD_START;
        if (exploration) return TYPE_EXPLORATION;
        if (availabilityScore >= 0.85) return TYPE_AVAILABLE_SOON;
        if (ratingScore >= 0.7) return TYPE_POPULAR;
        return TYPE_PERSONALIZED;
    }

    private List<String> buildReasons(
            double semanticScore,
            double categoryScore,
            double difficultyScore,
            double budgetScore,
            double ratingScore,
            double availabilityScore,
            double preferenceBoost,
            String recommendationType
    ) {
        List<String> reasons = new ArrayList<>();

        if (TYPE_COLD_START.equals(recommendationType)) reasons.add("A strong first pick for new explorers");
        if (TYPE_EXPLORATION.equals(recommendationType)) reasons.add("A fresh category to explore");
        if (semanticScore >= 0.72) reasons.add("Matches your activity profile");
        if (categoryScore >= 0.25) reasons.add("Fits categories you like");
        if (difficultyScore >= 0.25) reasons.add("Fits your preferred difficulty");
        if (budgetScore >= 0.65) reasons.add("Close to your usual budget");
        if (ratingScore >= 0.65) reasons.add("Highly rated by other users");
        if (availabilityScore >= 0.80) reasons.add("Available soon");
        if (preferenceBoost > 0) reasons.add("Matches your stated preferences");
        if (reasons.isEmpty()) reasons.add("Recommended from available activities");

        return reasons.stream().distinct().limit(3).toList();
    }

    private boolean isOwnedByCurrentGuide(ActivityTemplate template, String userId) {
        return template.getGuideId() != null && template.getGuideId().equals(userId);
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

    private String primaryCategory(ActivityTemplate template) {
        return safeList(template.getCategoryIds()).stream().filter(Objects::nonNull).findFirst().orElse(null);
    }

    private String toPriceBucket(BigDecimal price) {
        if (price == null) return "UNKNOWN";
        if (price.compareTo(BigDecimal.valueOf(50)) <= 0) return "BUDGET";
        if (price.compareTo(BigDecimal.valueOf(150)) <= 0) return "MID";
        return "PREMIUM";
    }

    private List<Booking> safeBookings(List<Booking> bookings) {
        return bookings != null ? bookings : List.of();
    }

    private List<Double> safeVector(List<Double> vector) {
        return vector != null ? vector : List.of();
    }

    private List<String> safeList(List<String> values) {
        return values != null ? values : List.of();
    }

    private String nullToEmpty(String value) {
        return value != null ? value : "";
    }

    private double clamp01(double value) {
        return Math.max(0.0, Math.min(1.0, value));
    }

    private double round(double value) {
        return Math.round(value * 1000.0) / 1000.0;
    }

    private record ScoredRecommendation(
            ActivityTemplate template,
            RecommendationItemResponse response,
            double score
    ) {
    }
}

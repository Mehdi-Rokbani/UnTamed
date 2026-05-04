package com.untamed.untamedbackend.recommendation.service.impl;

import com.untamed.untamedbackend.model.ActivityImage;
import com.untamed.untamedbackend.model.ActivitySession;
import com.untamed.untamedbackend.model.ActivityStatus;
import com.untamed.untamedbackend.model.ActivityTemplate;
import com.untamed.untamedbackend.recommendation.dto.RecommendationItemResponse;
import com.untamed.untamedbackend.recommendation.service.SimilarActivityService;
import com.untamed.untamedbackend.recommendation.util.VectorUtils;
import com.untamed.untamedbackend.repository.ActivitySessionRepository;
import com.untamed.untamedbackend.repository.ActivityTemplateRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class SimilarActivityServiceImpl implements SimilarActivityService {

    private static final double CATEGORY_WEIGHT = 0.30;
    private static final double HINT_WEIGHT = 0.25;
    private static final double EMBEDDING_WEIGHT = 0.25;
    private static final double FAMILY_WEIGHT = 0.10;
    private static final double DIFFICULTY_WEIGHT = 0.05;
    private static final double PRICE_WEIGHT = 0.05;

    private static final double MIN_CATEGORY_GATE = 0.25;
    private static final double MIN_HINT_GATE = 0.25;
    private static final double MIN_EMBEDDING_GATE = 0.70;
    private static final double EXTREME_EMBEDDING_GATE = 0.85;
    private static final String TYPE_SIMILAR = "SIMILAR";

    private final ActivityTemplateRepository activityTemplateRepository;
    private final ActivitySessionRepository activitySessionRepository;

    @Override
    public List<RecommendationItemResponse> findSimilar(String templateId, int limit) {
        ActivityTemplate current = activityTemplateRepository.findById(templateId)
                .orElseThrow(() -> new IllegalArgumentException("Activity template not found: " + templateId));

        Instant now = Instant.now();
        Map<String, ActivitySession> nextSessionByTemplateId = buildNextSessionByTemplateId(now);

        return activityTemplateRepository.findAll().stream()
                .filter(Objects::nonNull)
                .filter(candidate -> candidate.getId() != null)
                .filter(candidate -> !Objects.equals(candidate.getId(), current.getId()))
                .filter(candidate -> !Boolean.TRUE.equals(candidate.isArchived()))
                .filter(candidate -> nextSessionByTemplateId.containsKey(candidate.getId()))
                .map(candidate -> scoreCandidate(current, candidate, nextSessionByTemplateId.get(candidate.getId())))
                .filter(Objects::nonNull)
                .sorted(Comparator.comparingDouble(ScoredCandidate::score).reversed())
                .limit(Math.max(1, limit))
                .map(ScoredCandidate::response)
                .collect(Collectors.toList());
    }

    private ScoredCandidate scoreCandidate(
            ActivityTemplate current,
            ActivityTemplate candidate,
            ActivitySession nextSession
    ) {
        double categoryScore = categorySimilarity(current, candidate);
        double hintScore = semanticHintSimilarity(current, candidate);
        double embeddingScore = normalizedEmbeddingSimilarity(current, candidate);
        ActivityFamily currentFamily = detectFamily(current);
        ActivityFamily candidateFamily = detectFamily(candidate);
        boolean sameFamily = isSameStrongFamily(currentFamily, candidateFamily);

        if (!passesSimilarityGate(categoryScore, hintScore, embeddingScore, currentFamily, candidateFamily, sameFamily)) {
            return null;
        }

        double familyScore = sameFamily ? 1.0 : 0.0;
        double difficultyScore = sameDifficulty(current, candidate) ? 1.0 : 0.0;
        double priceScore = priceSimilarity(current.getPrice(), candidate.getPrice());

        double score =
                (categoryScore * CATEGORY_WEIGHT) +
                        (hintScore * HINT_WEIGHT) +
                        (embeddingScore * EMBEDDING_WEIGHT) +
                        (familyScore * FAMILY_WEIGHT) +
                        (difficultyScore * DIFFICULTY_WEIGHT) +
                        (priceScore * PRICE_WEIGHT);

        List<String> reasons = buildReasons(
                currentFamily,
                candidateFamily,
                familyScore,
                categoryScore,
                hintScore,
                embeddingScore,
                priceScore
        );

        RecommendationItemResponse response = RecommendationItemResponse.builder()
                .templateId(candidate.getId())
                .title(candidate.getTitle())
                .description(candidate.getDescription())
                .coverImageUrl(extractCoverImageUrl(candidate))
                .categoryIds(safeList(candidate.getCategoryIds()))
                .difficulty(candidate.getDifficulty() != null ? candidate.getDifficulty().name() : null)
                .price(candidate.getPrice())
                .ratingAverage(candidate.getRating() != null ? candidate.getRating().getAverage() : 0.0)
                .ratingCount(candidate.getRating() != null ? candidate.getRating().getCount() : 0)
                .nextSessionDate(nextSession.getStartAt())
                .score(round(score))
                .reasons(reasons)
                .semanticScore(round(embeddingScore))
                .categoryScore(round(categoryScore))
                .difficultyScore(round(difficultyScore))
                .budgetScore(round(priceScore))
                .ratingScore(null)
                .availabilityScore(null)
                .recommendationType(TYPE_SIMILAR)
                .build();

        return new ScoredCandidate(candidate, score, response);
    }

    private boolean passesSimilarityGate(
            double categoryScore,
            double hintScore,
            double embeddingScore,
            ActivityFamily currentFamily,
            ActivityFamily candidateFamily,
            boolean sameFamily
    ) {
        boolean currentHasFamily = currentFamily != ActivityFamily.UNKNOWN;
        boolean candidateHasFamily = candidateFamily != ActivityFamily.UNKNOWN;
        boolean differentKnownFamily = currentHasFamily && candidateHasFamily && currentFamily != candidateFamily;

        if (differentKnownFamily && embeddingScore < EXTREME_EMBEDDING_GATE) {
            return false;
        }

        if (currentFamily == ActivityFamily.WATER && candidateFamily != ActivityFamily.WATER && embeddingScore < EXTREME_EMBEDDING_GATE) {
            return false;
        }

        return categoryScore >= MIN_CATEGORY_GATE
                || hintScore >= MIN_HINT_GATE
                || embeddingScore >= MIN_EMBEDDING_GATE
                || sameFamily;
    }

    private Map<String, ActivitySession> buildNextSessionByTemplateId(Instant now) {
        Map<String, ActivitySession> nextSessionByTemplateId = new LinkedHashMap<>();

        activitySessionRepository.findByStatusAndStartAtAfter(ActivityStatus.PUBLISHED, now).stream()
                .filter(Objects::nonNull)
                .filter(session -> session.getTemplateId() != null)
                .filter(session -> session.getStartAt() != null)
                .sorted(Comparator.comparing(ActivitySession::getStartAt))
                .forEach(session -> nextSessionByTemplateId.putIfAbsent(session.getTemplateId(), session));

        return nextSessionByTemplateId;
    }

    private double normalizedEmbeddingSimilarity(ActivityTemplate current, ActivityTemplate candidate) {
        double cosine = VectorUtils.cosineSimilarity(current.getEmbeddingVector(), candidate.getEmbeddingVector());
        return clamp01((cosine + 1.0) / 2.0);
    }

    private double categorySimilarity(ActivityTemplate a, ActivityTemplate b) {
        Set<String> aCategories = safeSet(a.getCategoryIds());
        Set<String> bCategories = safeSet(b.getCategoryIds());

        if (aCategories.isEmpty() || bCategories.isEmpty()) {
            return 0.0;
        }

        Set<String> intersection = new HashSet<>(aCategories);
        intersection.retainAll(bCategories);

        Set<String> union = new HashSet<>(aCategories);
        union.addAll(bCategories);

        return union.isEmpty() ? 0.0 : (double) intersection.size() / union.size();
    }

    private double semanticHintSimilarity(ActivityTemplate a, ActivityTemplate b) {
        Set<String> aHints = normalizeTokens(a.getSemanticHints());
        Set<String> bHints = normalizeTokens(b.getSemanticHints());

        if (aHints.isEmpty() || bHints.isEmpty()) {
            return 0.0;
        }

        Set<String> intersection = new HashSet<>(aHints);
        intersection.retainAll(bHints);

        Set<String> union = new HashSet<>(aHints);
        union.addAll(bHints);

        return union.isEmpty() ? 0.0 : (double) intersection.size() / union.size();
    }

    private ActivityFamily detectFamily(ActivityTemplate template) {
        String blob = buildSearchBlob(template);

        if (containsAny(blob, "surf", "surfing", "sea", "beach", "ocean", "kayak", "kayaking",
                "diving", "snorkeling", "swimming", "paddle", "coastal", "aquatic", "marine")) {
            return ActivityFamily.WATER;
        }
        if (containsAny(blob, "hiking", "trekking", "climbing", "mountain", "trail")) {
            return ActivityFamily.MOUNTAIN;
        }
        if (containsAny(blob, "desert", "sahara", "dunes", "camel", "quad", "oasis")) {
            return ActivityFamily.DESERT;
        }
        if (containsAny(blob, "cycling", "bike", "biking", "bicycle")) {
            return ActivityFamily.CYCLING;
        }
        if (containsAny(blob, "marathon", "running", "race")) {
            return ActivityFamily.RUNNING;
        }
        if (containsAny(blob, "camping", "camp", "tent", "outdoor stay")) {
            return ActivityFamily.CAMPING;
        }

        return ActivityFamily.UNKNOWN;
    }

    private String buildSearchBlob(ActivityTemplate template) {
        if (template == null) {
            return "";
        }

        return String.join(" ",
                nullToEmpty(template.getTitle()),
                nullToEmpty(template.getDescription()),
                String.join(" ", safeList(template.getTags())),
                String.join(" ", safeList(template.getSemanticHints())),
                String.join(" ", safeList(template.getCategoryIds()))
        ).toLowerCase(Locale.ROOT);
    }

    private boolean containsAny(String blob, String... tokens) {
        if (blob == null || blob.isBlank()) {
            return false;
        }

        for (String token : tokens) {
            if (blob.contains(token)) {
                return true;
            }
        }
        return false;
    }

    private boolean isSameStrongFamily(ActivityFamily currentFamily, ActivityFamily candidateFamily) {
        return currentFamily != ActivityFamily.UNKNOWN && currentFamily == candidateFamily;
    }

    private boolean sameDifficulty(ActivityTemplate a, ActivityTemplate b) {
        return a.getDifficulty() != null
                && b.getDifficulty() != null
                && a.getDifficulty().equals(b.getDifficulty());
    }

    private double priceSimilarity(BigDecimal a, BigDecimal b) {
        if (a == null || b == null) {
            return 0.0;
        }

        double p1 = a.doubleValue();
        double p2 = b.doubleValue();
        if (p1 <= 0 || p2 <= 0) {
            return 0.0;
        }

        return clamp01(1.0 - (Math.abs(p1 - p2) / Math.max(p1, p2)));
    }

    private List<String> buildReasons(
            ActivityFamily currentFamily,
            ActivityFamily candidateFamily,
            double familyScore,
            double categoryScore,
            double hintScore,
            double embeddingScore,
            double priceScore
    ) {
        List<String> reasons = new ArrayList<>();

        if (familyScore > 0.0) {
            reasons.add("Same activity family");
            if (currentFamily == ActivityFamily.WATER && candidateFamily == ActivityFamily.WATER) {
                reasons.add("Similar water activity");
            }
        }
        if (categoryScore >= MIN_CATEGORY_GATE) reasons.add("Similar categories");
        if (hintScore >= MIN_HINT_GATE) reasons.add("Similar activity style");
        if (embeddingScore >= MIN_EMBEDDING_GATE) reasons.add("Strong semantic match");
        if (priceScore >= 0.75) reasons.add("Similar budget");

        return reasons.stream().distinct().limit(3).toList();
    }

    private String explainSimilarityDebug(
            ActivityTemplate current,
            ActivityTemplate candidate,
            double categoryScore,
            double hintScore,
            double embeddingScore,
            ActivityFamily currentFamily,
            ActivityFamily candidateFamily
    ) {
        return "current=" + safeId(current)
                + ", candidate=" + safeId(candidate)
                + ", categoryScore=" + round(categoryScore)
                + ", hintScore=" + round(hintScore)
                + ", embeddingScore=" + round(embeddingScore)
                + ", currentFamily=" + currentFamily
                + ", candidateFamily=" + candidateFamily;
    }

    private String extractCoverImageUrl(ActivityTemplate template) {
        if (template.getImages() != null && !template.getImages().isEmpty()) {
            ActivityImage first = template.getImages().get(0);
            return first != null ? first.getUrl() : null;
        }
        return null;
    }

    private Set<String> normalizeTokens(List<String> values) {
        if (values == null) {
            return Set.of();
        }

        return values.stream()
                .filter(Objects::nonNull)
                .map(value -> value.trim().toLowerCase(Locale.ROOT))
                .filter(value -> !value.isBlank())
                .collect(Collectors.toSet());
    }

    private Set<String> safeSet(List<String> list) {
        return list == null ? Set.of() : new HashSet<>(list);
    }

    private List<String> safeList(List<String> list) {
        return list == null ? List.of() : list;
    }

    private String nullToEmpty(String value) {
        return value != null ? value : "";
    }

    private String safeId(ActivityTemplate template) {
        return template != null ? template.getId() : "null";
    }

    private double clamp01(double value) {
        return Math.max(0.0, Math.min(1.0, value));
    }

    private double round(double value) {
        return Math.round(value * 1000.0) / 1000.0;
    }

    private enum ActivityFamily {
        WATER,
        MOUNTAIN,
        DESERT,
        CYCLING,
        RUNNING,
        CAMPING,
        UNKNOWN
    }

    private record ScoredCandidate(
            ActivityTemplate template,
            double score,
            RecommendationItemResponse response
    ) {
    }
}

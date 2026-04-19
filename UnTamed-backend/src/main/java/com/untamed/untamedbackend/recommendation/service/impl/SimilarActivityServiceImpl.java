package com.untamed.untamedbackend.recommendation.service.impl;

import com.untamed.untamedbackend.model.ActivityImage;
import com.untamed.untamedbackend.model.ActivityTemplate;
import com.untamed.untamedbackend.repository.ActivityTemplateRepository;
import com.untamed.untamedbackend.recommendation.dto.RecommendationItemResponse;
import com.untamed.untamedbackend.recommendation.service.SimilarActivityService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import com.untamed.untamedbackend.model.ActivitySession;
import com.untamed.untamedbackend.model.ActivityStatus;
import com.untamed.untamedbackend.repository.ActivitySessionRepository;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class SimilarActivityServiceImpl implements SimilarActivityService {

    private final ActivityTemplateRepository activityTemplateRepository;
    private final ActivitySessionRepository activitySessionRepository;

    @Override
    public List<RecommendationItemResponse> findSimilar(String templateId, int limit) {
        ActivityTemplate current = activityTemplateRepository.findById(templateId)
                .orElseThrow(() -> new IllegalArgumentException("Activity template not found: " + templateId));

        List<ActivityTemplate> allTemplates = activityTemplateRepository.findAll();

        return allTemplates.stream()
                .filter(candidate -> !Objects.equals(candidate.getId(), current.getId()))
                .filter(this::hasUpcomingSessions)
                .filter(candidate -> categorySimilarity(current, candidate)>=0.3)
                .map(candidate -> scoreCandidate(current, candidate))
                .filter(Objects::nonNull)
                .sorted(Comparator.comparingDouble(ScoredCandidate::score).reversed())
                .limit(Math.max(1, limit))
                .map(scored -> toResponse(scored.template(), scored.score(), scored.reasons()))
                .collect(Collectors.toList());

    }

    private ScoredCandidate scoreCandidate(ActivityTemplate current, ActivityTemplate candidate) {
        double score = 0.0;
        List<String> reasons = new ArrayList<>();

        double categoryScore = categorySimilarity(current, candidate);
        if (categoryScore > 0) {
            score += categoryScore * 0.45;
            reasons.add("Similar categories");
        }
        double hintScore = semanticHintSimilarity(current, candidate);
        if (hintScore > 0) {
            score += hintScore * 0.25;
            reasons.add("Similar activity type");
        }

        double embeddingScore = cosineSimilarity(
                current.getEmbeddingVector(),
                candidate.getEmbeddingVector()
        );
        if (embeddingScore > 0) {
            score += embeddingScore * 0.20;
            reasons.add("Semantically similar");
        }

        if (sameDifficulty(current, candidate)) {
            score += 0.10;
            reasons.add("Same difficulty");
        }

        double priceScore = priceSimilarity(current.getPrice(), candidate.getPrice());
        if (priceScore > 0) {
            score += priceScore * 0.10;
            reasons.add("Similar budget");
        }

        if (hasUpcomingSessions(candidate)) {
            score += 0.05;
            reasons.add("Has upcoming sessions");
        }

        if (score <= 0.0) {
            return null;
        }

        return new ScoredCandidate(candidate, score, reasons);
    }

    private boolean sharesCategory(ActivityTemplate a, ActivityTemplate b) {
        Set<String> aSet = new HashSet<>(safeList(a.getCategoryIds()));
        Set<String> bSet = new HashSet<>(safeList(b.getCategoryIds()));

        aSet.retainAll(bSet);
        return !aSet.isEmpty();
    }

    private double categorySimilarity(ActivityTemplate a, ActivityTemplate b) {
        Set<String> aCategories = safeSet(a.getCategoryIds());
        Set<String> bCategories = safeSet(b.getCategoryIds());

        if (aCategories.isEmpty() || bCategories.isEmpty()) {
            return 0.0;
        }

        Set<String> intersection = new HashSet<>(aCategories);
        intersection.retainAll(bCategories);

        if (intersection.isEmpty()) {
            return 0.0;
        }

        Set<String> union = new HashSet<>(aCategories);
        union.addAll(bCategories);

        return (double) intersection.size() / union.size();
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

        double max = Math.max(p1, p2);
        double diff = Math.abs(p1 - p2);

        double ratio = 1.0 - (diff / max);
        return Math.max(0.0, ratio);
    }

    private boolean hasUpcomingSessions(ActivityTemplate candidate) {
        return activitySessionRepository
                .findFirstByTemplateIdAndStatusAndStartAtAfterOrderByStartAtAsc(
                        candidate.getId(),
                        ActivityStatus.PUBLISHED,
                        Instant.now()
                )
                .isPresent();
    }

    private RecommendationItemResponse toResponse(ActivityTemplate template, double score, List<String> reasons) {
        return new RecommendationItemResponse(
                template.getId(),
                template.getTitle(),
                template.getDescription(),
                extractCoverImageUrl(template),
                safeList(template.getCategoryIds()),
                template.getDifficulty() != null ? template.getDifficulty().name() : null,
                template.getPrice() ,
                extractRatingAverage(template),
                extractRatingCount(template),
                extractNextSessionDate(template),
                score,
                reasons
        );
    }

    private String extractCoverImageUrl(ActivityTemplate template) {
        if (template.getImages() != null && !template.getImages().isEmpty()) {
            ActivityImage first = template.getImages().get(0);
            return first != null ? first.getUrl() : null;
        }
        return null;
    }

    private double extractRatingAverage(ActivityTemplate template) {
        return template.getRating() != null
                ? template.getRating().getAverage()
                : 0.0;
    }

    private int extractRatingCount(ActivityTemplate template) {
        return template.getRating() != null
                ? template.getRating().getCount()
                : 0;
    }


    private Instant extractNextSessionDate(ActivityTemplate template) {
        return activitySessionRepository
                .findFirstByTemplateIdAndStatusAndStartAtAfterOrderByStartAtAsc(
                        template.getId(),
                        ActivityStatus.PUBLISHED,
                        Instant.now()
                )
                .map(ActivitySession::getStartAt)
                .orElse(null);
    }

    private Set<String> safeSet(List<String> list) {
        return list == null ? Collections.emptySet() : new HashSet<>(list);
    }

    private List<String> safeList(List<String> list) {
        return list == null ? List.of() : list;
    }

    private record ScoredCandidate(
            ActivityTemplate template,
            double score,
            List<String> reasons
    ) {}


    private double cosineSimilarity(List<Double> v1, List<Double> v2) {
        if (v1 == null || v2 == null || v1.size() != v2.size() || v1.isEmpty()) {
            return 0.0;
        }

        double dot = 0.0;
        double norm1 = 0.0;
        double norm2 = 0.0;

        for (int i = 0; i < v1.size(); i++) {
            double a = v1.get(i);
            double b = v2.get(i);
            dot += a * b;
            norm1 += a * a;
            norm2 += b * b;
        }

        if (norm1 == 0.0 || norm2 == 0.0) {
            return 0.0;
        }

        return dot / (Math.sqrt(norm1) * Math.sqrt(norm2));
    }

    private double semanticHintSimilarity(ActivityTemplate a, ActivityTemplate b) {
        Set<String> aHints = new HashSet<>(a.getSemanticHints());
        Set<String> bHints = new HashSet<>(b.getSemanticHints());

        if (aHints.isEmpty() || bHints.isEmpty()) return 0.0;

        aHints.retainAll(bHints);
        return (double) aHints.size() / Math.max(1, b.getSemanticHints().size());
    }
}
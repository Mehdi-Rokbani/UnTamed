package com.untamed.untamedbackend.smartsearch.service;

import com.untamed.untamedbackend.model.ActivitySession;
import com.untamed.untamedbackend.model.ActivityTemplate;
import com.untamed.untamedbackend.recommendation.dto.RecommendationItemResponse;
import com.untamed.untamedbackend.recommendation.util.VectorUtils;
import com.untamed.untamedbackend.repository.ActivitySessionRepository;
import com.untamed.untamedbackend.repository.ActivityTemplateRepository;
import com.untamed.untamedbackend.smartsearch.dto.SmartSearchRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class SmartSearchService {

    private final ActivityTemplateRepository activityTemplateRepository;
    private final ActivitySessionRepository activitySessionRepository;
    private final QueryEmbeddingService queryEmbeddingService;

    private static final double UPCOMING_SESSION_BOOST = 0.03;
    private static final double RATING_MULTIPLIER = 0.006;
    private static final double INTENT_MATCH_BOOST = 0.20;
    private static final double TITLE_EXACT_BOOST = 0.18;
    private static final double DESCRIPTION_MATCH_BOOST = 0.08;
    private static final double TAG_MATCH_BOOST = 0.14;

    public List<RecommendationItemResponse> search(SmartSearchRequest request) {
        String query = normalizeQuery(request.getQuery());
        int limit = resolveLimit(request.getLimit());

        SearchIntent queryIntent = detectIntent(query);
        double minSemanticScore = resolveMinSemanticScore(query, queryIntent);

        List<Double> queryEmbedding = queryEmbeddingService.embedQuery(query);

        List<ActivitySession> allSessions = activitySessionRepository.findAll();
        Map<String, Instant> nextSessionByTemplateId = buildNextSessionMap(allSessions);

        List<ActivityTemplate> templates = activityTemplateRepository.findAll();

        List<ScoredTemplate> scored = templates.stream()
                .filter(Objects::nonNull)
                .filter(this::hasEmbedding)
                .filter(template -> matchesFilters(template, request))
                .filter(template -> matchesDateFilter(template.getId(), request, allSessions))
                .filter(template -> matchesIntentStrict(queryIntent, template))
                .map(template -> scoreTemplate(
                        template,
                        queryEmbedding,
                        query,
                        queryIntent,
                        nextSessionByTemplateId.get(template.getId())
                ))
                .filter(item -> item.semanticScore() >= minSemanticScore)
                .sorted(buildComparator(request, nextSessionByTemplateId))
                .limit(limit)
                .toList();

        return scored.stream()
                .map(item -> toResponse(item, nextSessionByTemplateId.get(item.template().getId())))
                .collect(Collectors.toList());
    }

    private ScoredTemplate scoreTemplate(
            ActivityTemplate template,
            List<Double> queryEmbedding,
            String query,
            SearchIntent queryIntent,
            Instant nextSessionDate
    ) {
        double semanticScore = VectorUtils.cosineSimilarity(queryEmbedding, template.getEmbeddingVector());

        if (semanticScore < 0.65) {
            semanticScore = 0.0;
        }

        double keywordBoost = computeKeywordBoost(query, template);
        double intentBoost = computeIntentBoost(queryIntent, template);
        double genericBoost = computeGenericBoost(template, nextSessionDate);

        double finalScore =
                (semanticScore * 0.55) +
                        keywordBoost +
                        intentBoost +
                        genericBoost;

        return new ScoredTemplate(
                template,
                semanticScore,
                keywordBoost,
                intentBoost,
                genericBoost,
                finalScore
        );
    }

    private double computeKeywordBoost(String query, ActivityTemplate template) {
        String normalizedQuery = normalizeLower(query);
        String title = normalizeLower(template.getTitle());
        String description = normalizeLower(template.getDescription());
        String embeddingText = normalizeLower(template.getEmbeddingText());

        List<String> tags = template.getTags() == null ? List.of() : template.getTags();
        String tagsBlob = tags.stream()
                .filter(Objects::nonNull)
                .map(this::normalizeLower)
                .collect(Collectors.joining(" "));

        double boost = 0.0;

        if (!normalizedQuery.isBlank() && title.contains(normalizedQuery)) {
            boost += TITLE_EXACT_BOOST;
        }

        if (!normalizedQuery.isBlank() && description.contains(normalizedQuery)) {
            boost += DESCRIPTION_MATCH_BOOST;
        }

        if (!normalizedQuery.isBlank() && tagsBlob.contains(normalizedQuery)) {
            boost += TAG_MATCH_BOOST;
        }

        for (String token : splitTokens(normalizedQuery)) {
            if (token.length() < 3) {
                continue;
            }

            if (title.contains(token)) {
                boost += 0.06;
            }
            if (tagsBlob.contains(token)) {
                boost += 0.05;
            }
            if (description.contains(token) || embeddingText.contains(token)) {
                boost += 0.03;
            }
        }

        return Math.min(boost, 0.35);
    }

    private double computeIntentBoost(SearchIntent queryIntent, ActivityTemplate template) {
        if (queryIntent == SearchIntent.GENERIC) {
            return 0.0;
        }

        SearchIntent templateIntent = detectTemplateIntent(template);
        if (templateIntent == queryIntent) {
            return INTENT_MATCH_BOOST;
        }

        return 0.0;
    }

    private double computeGenericBoost(ActivityTemplate template, Instant nextSessionDate) {
        double boost = 0.0;

        if (nextSessionDate != null) {
            boost += UPCOMING_SESSION_BOOST;
        }

        if (template.getRating() != null) {
            boost += template.getRating().getAverage() * RATING_MULTIPLIER;
        }

        return boost;
    }

    private boolean matchesIntentStrict(SearchIntent queryIntent, ActivityTemplate template) {
        if (queryIntent == SearchIntent.GENERIC) {
            return true;
        }

        String blob = buildTemplateSearchBlob(template);

        return switch (queryIntent) {
            case WATER -> containsAny(blob,
                    "water", "sea", "diving", "scuba", "snorkeling", "snorkelling",
                    "kayak", "kayaking", "paddle", "underwater", "marine", "boat", "ocean"
            );

            case NATURE -> containsAny(blob,
                    "hike", "hiking", "trail", "trek", "trekking", "mountain",
                    "forest", "camping", "walk", "randonnee", "randonnée"
            );

            case RUNNING -> containsAny(blob,
                    "run", "running", "marathon", "race", "road race", "endurance"
            );

            case DESERT -> containsAny(blob,
                    "desert", "sahara", "dune", "dunes", "camel", "quad", "oasis"
            );

            case GENERIC -> true;
        };
    }

    private SearchIntent detectIntent(String query) {
        String q = normalizeLower(query);

        if (containsAny(q,
                "water", "sea", "diving", "scuba", "underwater", "aquatic",
                "marine", "ocean", "kayak", "kayaking", "paddle", "snorkeling", "snorkelling"
        )) {
            return SearchIntent.WATER;
        }

        if (containsAny(q,
                "hiking", "hike", "trail", "mountain", "trek", "trekking",
                "walk", "randonnee", "randonnée", "camping", "forest"
        )) {
            return SearchIntent.NATURE;
        }

        if (containsAny(q,
                "run", "running", "marathon", "race", "fitness", "endurance"
        )) {
            return SearchIntent.RUNNING;
        }

        if (containsAny(q,
                "desert", "sahara", "dunes", "dune", "camel", "oasis", "quad"
        )) {
            return SearchIntent.DESERT;
        }

        return SearchIntent.GENERIC;
    }

    private SearchIntent detectTemplateIntent(ActivityTemplate template) {
        String blob = buildTemplateSearchBlob(template);

        if (containsAny(blob,
                "water", "sea", "diving", "scuba", "snorkeling", "snorkelling",
                "kayak", "kayaking", "paddle", "underwater", "marine", "boat", "ocean"
        )) {
            return SearchIntent.WATER;
        }

        if (containsAny(blob,
                "hike", "hiking", "trail", "trek", "trekking", "mountain",
                "forest", "camping", "walk", "randonnee", "randonnée"
        )) {
            return SearchIntent.NATURE;
        }

        if (containsAny(blob,
                "run", "running", "marathon", "race", "road race", "endurance"
        )) {
            return SearchIntent.RUNNING;
        }

        if (containsAny(blob,
                "desert", "sahara", "dune", "dunes", "camel", "quad", "oasis"
        )) {
            return SearchIntent.DESERT;
        }

        return SearchIntent.GENERIC;
    }

    private String buildTemplateSearchBlob(ActivityTemplate template) {
        StringBuilder sb = new StringBuilder();

        if (template.getTitle() != null) {
            sb.append(template.getTitle()).append(' ');
        }
        if (template.getDescription() != null) {
            sb.append(template.getDescription()).append(' ');
        }
        if (template.getEmbeddingText() != null) {
            sb.append(template.getEmbeddingText()).append(' ');
        }
        if (template.getTags() != null) {
            for (String tag : template.getTags()) {
                if (tag != null) {
                    sb.append(tag).append(' ');
                }
            }
        }

        return normalizeLower(sb.toString());
    }

    private boolean containsAny(String text, String... terms) {
        for (String term : terms) {
            if (text.contains(term.toLowerCase(Locale.ROOT))) {
                return true;
            }
        }
        return false;
    }

    private double resolveMinSemanticScore(String query, SearchIntent intent) {
        String normalized = normalizeQuery(query);
        int wordCount = normalized.split("\\s+").length;

        if (intent != SearchIntent.GENERIC) {
            if (wordCount == 1) return 0.58;
            if (wordCount == 2) return 0.60;
            if (wordCount <= 5) return 0.62;
            return 0.65;
        }

        if (wordCount == 1) return 0.55;
        if (wordCount == 2) return 0.58;
        if (wordCount <= 5) return 0.60;
        return 0.63;
    }

    private String normalizeQuery(String query) {
        if (query == null || query.trim().isEmpty()) {
            throw new IllegalArgumentException("query must not be blank");
        }
        return query.trim();
    }

    private String normalizeLower(String value) {
        return value == null ? "" : value.toLowerCase(Locale.ROOT).trim();
    }

    private List<String> splitTokens(String query) {
        if (query == null || query.isBlank()) {
            return List.of();
        }
        return Arrays.stream(query.split("\\s+"))
                .map(String::trim)
                .filter(token -> !token.isBlank())
                .toList();
    }

    private int resolveLimit(Integer limit) {
        if (limit == null) {
            return 10;
        }
        return Math.max(1, Math.min(limit, 50));
    }

    private boolean hasEmbedding(ActivityTemplate template) {
        return template.getEmbeddingVector() != null
                && !template.getEmbeddingVector().isEmpty();
    }

    private boolean matchesFilters(ActivityTemplate template, SmartSearchRequest request) {
        if (request.getCategoryId() != null && !request.getCategoryId().isBlank()) {
            if (template.getCategoryIds() == null ||
                    !template.getCategoryIds().contains(request.getCategoryId())) {
                return false;
            }
        }

        if (request.getDifficulty() != null &&
                template.getDifficulty() != request.getDifficulty()) {
            return false;
        }

        if (request.getMinPrice() != null &&
                comparePrice(template.getPrice(), request.getMinPrice()) < 0) {
            return false;
        }

        if (request.getMaxPrice() != null &&
                comparePrice(template.getPrice(), request.getMaxPrice()) > 0) {
            return false;
        }

        if (request.getAddressId() != null && !request.getAddressId().isBlank()) {
            if (!request.getAddressId().equals(template.getAddressId())) {
                return false;
            }
        }

        return true;
    }

    private boolean matchesDateFilter(
            String templateId,
            SmartSearchRequest request,
            List<ActivitySession> sessions
    ) {
        if ((request.getDateFrom() == null || request.getDateFrom().isBlank()) &&
                (request.getDateTo() == null || request.getDateTo().isBlank())) {
            return true;
        }

        Instant from = null;
        Instant to = null;

        try {
            if (request.getDateFrom() != null && !request.getDateFrom().isBlank()) {
                from = Instant.parse(request.getDateFrom());
            }
            if (request.getDateTo() != null && !request.getDateTo().isBlank()) {
                to = Instant.parse(request.getDateTo());
            }
        } catch (Exception e) {
            return true;
        }

        Instant finalFrom = from;
        Instant finalTo = to;

        return sessions.stream()
                .filter(Objects::nonNull)
                .filter(s -> templateId.equals(s.getTemplateId()))
                .map(ActivitySession::getDate)
                .filter(Objects::nonNull)
                .anyMatch(date -> {
                    boolean afterFrom = finalFrom == null || !date.isBefore(finalFrom);
                    boolean beforeTo = finalTo == null || !date.isAfter(finalTo);
                    return afterFrom && beforeTo;
                });
    }

    private int comparePrice(BigDecimal price, BigDecimal filterPrice) {
        if (price == null && filterPrice == null) return 0;
        if (price == null) return -1;
        if (filterPrice == null) return 1;
        return price.compareTo(filterPrice);
    }

    private Comparator<ScoredTemplate> buildComparator(
            SmartSearchRequest request,
            Map<String, Instant> nextSessionByTemplateId
    ) {
        String sort = request.getSort() == null ? "" : request.getSort().trim();

        return switch (sort) {
            case "priceAsc" -> Comparator
                    .comparing((ScoredTemplate item) -> nullSafePrice(item.template().getPrice()))
                    .thenComparing(ScoredTemplate::finalScore, Comparator.reverseOrder());

            case "priceDesc" -> Comparator
                    .comparing((ScoredTemplate item) -> nullSafePrice(item.template().getPrice()), Comparator.reverseOrder())
                    .thenComparing(ScoredTemplate::finalScore, Comparator.reverseOrder());

            case "soonest" -> Comparator
                    .comparing((ScoredTemplate item) -> nullSafeInstant(nextSessionByTemplateId.get(item.template().getId())))
                    .thenComparing(ScoredTemplate::finalScore, Comparator.reverseOrder());

            case "popular" -> Comparator
                    .comparingDouble(ScoredTemplate::finalScore)
                    .reversed();

            default -> Comparator
                    .comparingDouble(ScoredTemplate::finalScore)
                    .reversed();
        };
    }

    private BigDecimal nullSafePrice(BigDecimal price) {
        return price == null ? new BigDecimal("999999999") : price;
    }

    private Instant nullSafeInstant(Instant instant) {
        return instant == null ? Instant.parse("9999-12-31T23:59:59Z") : instant;
    }

    private Map<String, Instant> buildNextSessionMap(List<ActivitySession> sessions) {
        Instant now = Instant.now();
        Map<String, Instant> nextByTemplateId = new HashMap<>();

        for (ActivitySession session : sessions) {
            if (session == null || session.getTemplateId() == null || session.getDate() == null) {
                continue;
            }

            if (!session.getDate().isAfter(now)) {
                continue;
            }

            Instant existing = nextByTemplateId.get(session.getTemplateId());
            if (existing == null || session.getDate().isBefore(existing)) {
                nextByTemplateId.put(session.getTemplateId(), session.getDate());
            }
        }

        return nextByTemplateId;
    }

    private RecommendationItemResponse toResponse(ScoredTemplate item, Instant nextSessionDate) {
        ActivityTemplate template = item.template();

        return RecommendationItemResponse.builder()
                .templateId(template.getId())
                .title(template.getTitle())
                .description(template.getDescription())
                .coverImageUrl(getCoverImage(template))
                .categoryIds(template.getCategoryIds())
                .difficulty(template.getDifficulty().name())
                .price(template.getPrice())
                .ratingAverage(template.getRating() != null ? template.getRating().getAverage() : 0.0)
                .ratingCount(template.getRating() != null ? template.getRating().getCount() : 0)
                .nextSessionDate(nextSessionDate)
                .score(item.finalScore())
                .reasons(List.of(buildReason(item, nextSessionDate)))
                .build();
    }

    private String buildReason(ScoredTemplate item, Instant nextSessionDate) {
        if (item.intentBoost() > 0.0 && nextSessionDate != null) {
            return "Strong intent match with upcoming availability";
        }
        if (item.intentBoost() > 0.0) {
            return "Strong intent match for your search";
        }
        if (item.keywordBoost() >= 0.15 && nextSessionDate != null) {
            return "Strong text match with upcoming availability";
        }
        if (item.keywordBoost() >= 0.15) {
            return "Strong text match for your search";
        }
        if (nextSessionDate != null && item.genericBoost() > 0.0) {
            return "Relevant semantic match with upcoming availability";
        }
        return "Relevant semantic match for your search";
    }

    private String getCoverImage(ActivityTemplate template) {
        if (template.getImages() == null || template.getImages().isEmpty()) {
            return null;
        }
        return template.getImages().get(0).getUrl();
    }

    private enum SearchIntent {
        GENERIC,
        WATER,
        NATURE,
        RUNNING,
        DESERT
    }

    private record ScoredTemplate(
            ActivityTemplate template,
            double semanticScore,
            double keywordBoost,
            double intentBoost,
            double genericBoost,
            double finalScore
    ) {}
}
package com.untamed.untamedbackend.smartsearch.service;

import com.untamed.untamedbackend.model.ActivitySession;
import com.untamed.untamedbackend.model.ActivityStatus;
import com.untamed.untamedbackend.model.ActivityTemplate;
import com.untamed.untamedbackend.dto.PaginatedResponse;
import com.untamed.untamedbackend.recommendation.dto.RecommendationItemResponse;
import com.untamed.untamedbackend.recommendation.util.VectorUtils;
import com.untamed.untamedbackend.repository.ActivitySessionRepository;
import com.untamed.untamedbackend.repository.ActivityTemplateRepository;
import com.untamed.untamedbackend.smartsearch.dto.AiSearchPlan;
import com.untamed.untamedbackend.smartsearch.dto.SmartSearchRequest;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.*;
import java.util.stream.Collectors;

@Service
@Slf4j
@RequiredArgsConstructor
public class SmartSearchService {

    private final ActivityTemplateRepository activityTemplateRepository;
    private final ActivitySessionRepository activitySessionRepository;
    private final QueryEmbeddingService queryEmbeddingService;
    private final AiQueryUnderstandingService aiQueryUnderstandingService;

    private static final double UPCOMING_SESSION_BOOST = 0.03;
    private static final double RATING_MULTIPLIER = 0.006;
    private static final double INTENT_MATCH_BOOST = 0.20;
    private static final double TITLE_EXACT_BOOST = 0.18;
    private static final double DESCRIPTION_MATCH_BOOST = 0.08;
    private static final double TAG_MATCH_BOOST = 0.14;
    private static final double AI_ANCHOR_MATCH_BOOST = 0.08;

    private static final double FALLBACK_MIN_FINAL_SCORE = 0.25;
    private static final double FALLBACK_RELATIVE_TOP_RATIO = 0.55;

    public List<RecommendationItemResponse> search(SmartSearchRequest request) {
        String query = normalizeQuery(request.getQuery());
        int limit = resolveLimit(request.getLimit());

        AiSearchPlan plan = aiQueryUnderstandingService.buildPlan(query);
        SearchIntent queryIntent = resolveIntent(plan, query);
        double minSemanticScore = resolveMinSemanticScore(plan, query, queryIntent);
        String semanticQuery = buildSemanticQuery(plan, query);

        log.info("🔍 Smart search query='{}', semanticQuery='{}', limit={}, intent={}, strictness={}, minSemanticScore={}",
                query,
                semanticQuery,
                limit,
                queryIntent,
                plan != null ? plan.getStrictness() : null,
                minSemanticScore);

        List<Double> queryEmbedding = queryEmbeddingService.embedQuery(semanticQuery);
        log.info("🧠 Query embedding size={}", queryEmbedding != null ? queryEmbedding.size() : 0);

        if (queryEmbedding == null || queryEmbedding.isEmpty()) {
            log.warn("⚠️ Query embedding is empty, returning no results");
            return List.of();
        }

        List<ActivitySession> allSessions = activitySessionRepository.findAll();
        Map<String, Instant> nextSessionByTemplateId = buildNextSessionMap(allSessions);

        log.info("📅 Sessions fetched={}, templates with next session={}",
                allSessions.size(), nextSessionByTemplateId.size());

        List<ActivityTemplate> templates = activityTemplateRepository.findAll();
        log.info("📦 Templates fetched={}", templates.size());

        List<ActivityTemplate> nonNullTemplates = templates.stream()
                .filter(Objects::nonNull)
                .toList();
        log.info("✅ Non-null templates={}", nonNullTemplates.size());

        List<ActivityTemplate> embeddedTemplates = nonNullTemplates.stream()
                .filter(this::hasEmbedding)
                .toList();
        log.info("🧠 Templates with embeddings={}", embeddedTemplates.size());

        List<ActivityTemplate> filterMatchedTemplates = embeddedTemplates.stream()
                .filter(template -> matchesFilters(template, request))
                .toList();
        log.info("🎛️ After request filters={}", filterMatchedTemplates.size());

        List<ActivityTemplate> dateMatchedTemplates = filterMatchedTemplates.stream()
                .filter(template -> matchesDateFilter(template.getId(), request, allSessions))
                .toList();
        log.info("📆 After date filters={}", dateMatchedTemplates.size());

        List<ActivityTemplate> intentMatchedTemplates = dateMatchedTemplates.stream()
                .filter(template -> matchesIntentStrict(queryIntent, template))
                .toList();
        log.info("🎯 After intent strict match={}", intentMatchedTemplates.size());

        List<ActivityTemplate> candidates = intentMatchedTemplates;
        if (candidates.isEmpty() && queryIntent != SearchIntent.GENERIC) {
            log.warn("↩️ Strict intent match returned 0 results, falling back to date-matched templates");
            candidates = dateMatchedTemplates;
        }

        if (queryIntent != SearchIntent.GENERIC) {
            List<ActivityTemplate> tokenMatchedCandidates = candidates.stream()
                    .filter(template -> hasImportantTokenOverlap(plan, query, template))
                    .toList();

            log.info("🔤 After important token overlap={}", tokenMatchedCandidates.size());

            if (!tokenMatchedCandidates.isEmpty()) {
                candidates = tokenMatchedCandidates;
            } else {
                log.warn("↩️ Important token overlap returned 0 results, keeping previous candidate set");
            }
        }

        List<ScoredTemplate> scoredBeforeThreshold = candidates.stream()
                .map(template -> scoreTemplate(
                        template,
                        queryEmbedding,
                        plan,
                        query,
                        queryIntent,
                        nextSessionByTemplateId.get(template.getId())
                ))
                .sorted((a, b) -> Double.compare(b.semanticScore(), a.semanticScore()))
                .toList();

        log.info("📊 Scored templates before threshold={}", scoredBeforeThreshold.size());

        scoredBeforeThreshold.stream()
                .limit(10)
                .forEach(item -> log.info(
                        "📈 Candidate title='{}', semanticScore={}, keywordBoost={}, intentBoost={}, genericBoost={}, aiAnchorBoost={}, finalScore={}",
                        item.template().getTitle(),
                        item.semanticScore(),
                        item.keywordBoost(),
                        item.intentBoost(),
                        item.genericBoost(),
                        item.aiAnchorBoost(),
                        item.finalScore()
                ));

        List<ScoredTemplate> thresholded = scoredBeforeThreshold.stream()
                .filter(item ->
                        item.semanticScore() >= minSemanticScore
                                || item.keywordBoost() >= 0.18
                                || item.finalScore() >= 0.30
                )
                .toList();

        log.info("✅ Results after semantic/lexical threshold={}", thresholded.size());

        List<ScoredTemplate> scored;
        if (!thresholded.isEmpty()) {
            scored = thresholded.stream()
                    .sorted(buildComparator(request, nextSessionByTemplateId))
                    .limit(limit)
                    .toList();
        } else {
            double topScore = scoredBeforeThreshold.isEmpty() ? 0.0 : scoredBeforeThreshold.get(0).finalScore();

            log.warn("↩️ No results after threshold={}, using fallback top scored results. topScore={}",
                    minSemanticScore, topScore);

            scored = scoredBeforeThreshold.stream()
                    .filter(item -> item.finalScore() + 1e-9 >= FALLBACK_MIN_FINAL_SCORE)
                    .filter(item -> topScore == 0.0 || item.finalScore() + 1e-9 >= topScore * FALLBACK_RELATIVE_TOP_RATIO)
                    .sorted(buildComparator(request, nextSessionByTemplateId))
                    .limit(limit)
                    .toList();
        }

        log.info("✅ Final results after sort/limit={}", scored.size());

        return scored.stream()
                .map(item -> toResponse(item, nextSessionByTemplateId.get(item.template().getId())))
                .collect(Collectors.toList());
    }

    public PaginatedResponse<RecommendationItemResponse> searchPage(SmartSearchRequest request, int page, int size) {
        int originalLimit = request.getLimit() == null ? 10 : request.getLimit();
        int requestedLimit = Math.min(50, Math.max(size, (page + 1) * size));
        request.setLimit(requestedLimit);

        List<RecommendationItemResponse> ranked = search(request);
        request.setLimit(originalLimit);

        int from = Math.min(page * size, ranked.size());
        int to = Math.min(from + size, ranked.size());

        return PaginatedResponse.of(ranked.subList(from, to), page, size, ranked.size());
    }

    private ScoredTemplate scoreTemplate(
            ActivityTemplate template,
            List<Double> queryEmbedding,
            AiSearchPlan plan,
            String rawQuery,
            SearchIntent queryIntent,
            Instant nextSessionDate
    ) {
        double semanticScore = VectorUtils.cosineSimilarity(queryEmbedding, template.getEmbeddingVector());

        if (Double.isNaN(semanticScore) || Double.isInfinite(semanticScore)) {
            semanticScore = 0.0;
        }

        semanticScore = Math.max(0.0, semanticScore);

        double keywordBoost = computeKeywordBoost(plan, rawQuery, template);
        double intentBoost = computeIntentBoost(queryIntent, template);
        double genericBoost = computeGenericBoost(template, nextSessionDate);
        double aiAnchorBoost = computeAiAnchorBoost(template, plan);

        double finalScore =
                (semanticScore * 0.55) +
                        keywordBoost +
                        intentBoost +
                        genericBoost +
                        aiAnchorBoost;

        return new ScoredTemplate(
                template,
                semanticScore,
                keywordBoost,
                intentBoost,
                genericBoost,
                aiAnchorBoost,
                finalScore
        );
    }

    private double computeKeywordBoost(AiSearchPlan plan, String rawQuery, ActivityTemplate template) {
        String normalizedQuery = normalizeLower(rawQuery);
        String title = normalizeLower(template.getTitle());
        String description = normalizeLower(template.getDescription());
        String embeddingText = normalizeLower(template.getEmbeddingText());

        List<String> tags = template.getTags() == null ? List.of() : template.getTags();
        String tagsBlob = tags.stream()
                .filter(Objects::nonNull)
                .map(this::normalizeLower)
                .collect(Collectors.joining(" "));

        Set<String> queryTerms = new LinkedHashSet<>();

        if (!normalizedQuery.isBlank()) {
            queryTerms.add(normalizedQuery);
        }

        splitTokens(normalizedQuery).stream()
                .filter(token -> token.length() >= 3)
                .forEach(queryTerms::add);

        if (plan != null && plan.getConcepts() != null) {
            plan.getConcepts().stream()
                    .filter(Objects::nonNull)
                    .map(this::normalizeLower)
                    .filter(term -> !term.isBlank())
                    .forEach(queryTerms::add);
        }

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

        for (String term : queryTerms) {
            if (term.length() < 3) {
                continue;
            }

            if (title.contains(term)) {
                boost += 0.06;
            }
            if (tagsBlob.contains(term)) {
                boost += 0.05;
            }
            if (description.contains(term) || embeddingText.contains(term)) {
                boost += 0.03;
            }
        }

        return Math.min(boost, 0.45);
    }

    private double computeIntentBoost(SearchIntent queryIntent, ActivityTemplate template) {
        if (queryIntent == SearchIntent.GENERIC) {
            return 0.0;
        }

        SearchIntent templateIntent = detectTemplateIntent(template);

        log.info("🎯 Template intent check: title='{}', queryIntent={}, templateIntent={}",
                template.getTitle(), queryIntent, templateIntent);

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

    private double computeAiAnchorBoost(ActivityTemplate template, AiSearchPlan plan) {
        if (plan == null || plan.getMustIncludeAny() == null || plan.getMustIncludeAny().isEmpty()) {
            return 0.0;
        }

        String blob = buildTemplateSearchBlob(template);

        boolean matched = plan.getMustIncludeAny().stream()
                .filter(Objects::nonNull)
                .map(this::normalizeLower)
                .filter(term -> !term.isBlank())
                .anyMatch(blob::contains);

        return matched ? AI_ANCHOR_MATCH_BOOST : 0.0;
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

    private boolean hasImportantTokenOverlap(AiSearchPlan plan, String rawQuery, ActivityTemplate template) {
        String blob = buildTemplateSearchBlob(template);
        Set<String> importantTokens = new LinkedHashSet<>();

        splitTokens(normalizeLower(rawQuery)).stream()
                .filter(token -> token.length() >= 4)
                .forEach(importantTokens::add);

        if (plan != null && plan.getConcepts() != null) {
            plan.getConcepts().stream()
                    .filter(Objects::nonNull)
                    .map(this::normalizeLower)
                    .filter(token -> token.length() >= 4)
                    .forEach(importantTokens::add);
        }

        if (importantTokens.isEmpty()) {
            return true;
        }

        return importantTokens.stream().anyMatch(blob::contains);
    }

    private SearchIntent resolveIntent(AiSearchPlan plan, String query) {
        if (plan != null && plan.getIntent() != null && !plan.getIntent().isBlank()) {
            try {
                return SearchIntent.valueOf(plan.getIntent().trim().toUpperCase(Locale.ROOT));
            } catch (IllegalArgumentException ignored) {
                log.warn("Unknown AI intent '{}', falling back to local detection", plan.getIntent());
            }
        }
        return detectIntent(query);
    }

    private String buildSemanticQuery(AiSearchPlan plan, String rawQuery) {
        if (plan == null || plan.getConcepts() == null || plan.getConcepts().isEmpty()) {
            return rawQuery;
        }

        return plan.getConcepts().stream()
                .filter(Objects::nonNull)
                .map(String::trim)
                .filter(s -> !s.isBlank())
                .distinct()
                .collect(Collectors.joining(" "));
    }

    private double resolveMinSemanticScore(AiSearchPlan plan, String query, SearchIntent fallbackIntent) {
        if (plan != null && plan.getStrictness() != null) {
            String strictness = plan.getStrictness().trim().toUpperCase(Locale.ROOT);
            return switch (strictness) {
                case "HIGH" -> 0.40;
                case "MEDIUM" -> 0.33;
                case "LOW" -> 0.26;
                default -> resolveMinSemanticScore(query, fallbackIntent);
            };
        }
        return resolveMinSemanticScore(query, fallbackIntent);
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
                "desert", "sahara", "dune", "dunes", "camel", "quad", "oasis", "ksar", "ghilane"
        )) {
            return SearchIntent.DESERT;
        }

        if (containsAny(blob,
                "run", "running", "marathon", "race", "road race", "endurance"
        )) {
            return SearchIntent.RUNNING;
        }

        if (containsAny(blob,
                "hike", "hiking", "trail", "trek", "trekking", "mountain",
                "forest", "camping", "walk", "randonnee", "randonnée"
        )) {
            return SearchIntent.NATURE;
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
            if (wordCount == 1) return 0.30;
            if (wordCount == 2) return 0.33;
            if (wordCount <= 5) return 0.36;
            return 0.40;
        }

        if (wordCount == 1) return 0.28;
        if (wordCount == 2) return 0.30;
        if (wordCount <= 5) return 0.33;
        return 0.36;
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
            log.warn("Invalid date filter format in smart search: from='{}', to='{}'",
                    request.getDateFrom(), request.getDateTo());
            return true;
        }

        Instant finalFrom = from;
        Instant finalTo = to;

        return sessions.stream()
                .filter(Objects::nonNull)
                .filter(s -> templateId.equals(s.getTemplateId()))
                .filter(s -> s.getStatus() == ActivityStatus.PUBLISHED)
                .map(ActivitySession::getStartAt)
                .filter(Objects::nonNull)
                .anyMatch(startAt -> {
                    boolean afterFrom = finalFrom == null || !startAt.isBefore(finalFrom);
                    boolean beforeTo = finalTo == null || !startAt.isAfter(finalTo);
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
                    .comparing(
                            (ScoredTemplate item) -> nullSafePrice(item.template().getPrice()),
                            Comparator.reverseOrder()
                    )
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
            if (session == null || session.getTemplateId() == null || session.getStartAt() == null) {
                continue;
            }

            if (session.getStatus() != ActivityStatus.PUBLISHED) {
                continue;
            }

            if (!session.getStartAt().isAfter(now)) {
                continue;
            }

            Instant existing = nextByTemplateId.get(session.getTemplateId());
            if (existing == null || session.getStartAt().isBefore(existing)) {
                nextByTemplateId.put(session.getTemplateId(), session.getStartAt());
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
                .difficulty(template.getDifficulty() != null ? template.getDifficulty().name() : null)
                .price(template.getPrice())
                .ratingAverage(template.getRating() != null ? template.getRating().getAverage() : 0.0)
                .ratingCount(template.getRating() != null ? template.getRating().getCount() : 0)
                .nextSessionDate(nextSessionDate)
                .score(item.finalScore())
                .reasons(List.of(buildReason(item, nextSessionDate)))
                .build();
    }

    private String buildReason(ScoredTemplate item, Instant nextSessionDate) {
        if (item.semanticScore() >= 0.50 && item.keywordBoost() >= 0.15 && nextSessionDate != null) {
            return "Strong semantic and text match with upcoming availability";
        }
        if (item.semanticScore() >= 0.50 && item.keywordBoost() >= 0.15) {
            return "Strong semantic and text match for your search";
        }
        if (item.intentBoost() > 0.0 && item.keywordBoost() >= 0.10 && nextSessionDate != null) {
            return "Strong intent match with upcoming availability";
        }
        if (item.intentBoost() > 0.0 && item.keywordBoost() >= 0.10) {
            return "Strong intent match for your search";
        }
        if (item.keywordBoost() >= 0.15 && nextSessionDate != null) {
            return "Good text match with upcoming availability";
        }
        if (item.keywordBoost() >= 0.15) {
            return "Good text match for your search";
        }
        if (nextSessionDate != null) {
            return "Related activity with upcoming availability";
        }
        return "Related activity for your search";
    }

    private String getCoverImage(ActivityTemplate template) {
        if (template.getImages() == null || template.getImages().isEmpty()) {
            return null;
        }
        if (template.getImages().get(0) == null) {
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
            double aiAnchorBoost,
            double finalScore
    ) {}
}

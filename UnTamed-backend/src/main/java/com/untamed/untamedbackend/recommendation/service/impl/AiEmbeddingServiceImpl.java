package com.untamed.untamedbackend.recommendation.service.impl;

import com.untamed.untamedbackend.model.ActivityTemplate;
import com.untamed.untamedbackend.model.Category;
import com.untamed.untamedbackend.model.User;
import com.untamed.untamedbackend.model.UserInsight;
import com.untamed.untamedbackend.recommendation.dto.TemplateEmbeddingPayload;
import com.untamed.untamedbackend.recommendation.dto.UpdateTemplateEmbeddingRequest;
import com.untamed.untamedbackend.recommendation.dto.UpdateUserEmbeddingRequest;
import com.untamed.untamedbackend.recommendation.dto.UserEmbeddingPayload;
import com.untamed.untamedbackend.recommendation.service.AiEmbeddingService;
import com.untamed.untamedbackend.repository.ActivityTemplateRepository;
import com.untamed.untamedbackend.repository.CategoryRepository;
import com.untamed.untamedbackend.repository.UserRepository;
import com.untamed.untamedbackend.service.UserInsightService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class AiEmbeddingServiceImpl implements AiEmbeddingService {

    private final ActivityTemplateRepository activityTemplateRepository;
    private final UserInsightService userInsightService;
    private final CategoryRepository categoryRepository;
    private final UserRepository userRepository;

    @Override
    public TemplateEmbeddingPayload getTemplateEmbeddingPayload(String templateId) {
        ActivityTemplate template = activityTemplateRepository.findById(templateId)
                .orElseThrow(() -> new IllegalArgumentException("Activity template not found"));

        List<String> categoryIds = safeList(template.getCategoryIds());
        List<String> categoryNames = resolveCategoryNames(categoryIds);

        String difficulty = template.getDifficulty() != null ? template.getDifficulty().name() : null;

        String embeddingTextHint = buildTemplateEmbeddingHint(
                template.getTitle(),
                template.getDescription(),
                categoryNames,
                difficulty,
                template.getPrice(),
                safeList(template.getTags())
        );

        return TemplateEmbeddingPayload.builder()
                .templateId(template.getId())
                .title(template.getTitle())
                .description(template.getDescription())
                .difficulty(difficulty)
                .price(template.getPrice())
                .tags(safeList(template.getTags()))
                .categoryIds(categoryIds)
                .categoryNames(categoryNames)
                .embeddingTextHint(embeddingTextHint)
                .build();
    }

    @Override
    public void updateTemplateEmbedding(String templateId, UpdateTemplateEmbeddingRequest request) {
        ActivityTemplate template = activityTemplateRepository.findById(templateId)
                .orElseThrow(() -> new IllegalArgumentException("Activity template not found"));

        template.setEmbeddingText(request.getEmbeddingText());
        template.setEmbeddingVector(request.getEmbeddingVector());
        template.setEmbeddingUpdatedAt(Instant.now());

        activityTemplateRepository.save(template);
    }

    @Override
    public UserEmbeddingPayload getUserEmbeddingPayload(String userId) {
        UserInsight insight = userInsightService.getByUserId(userId);
        User user = userRepository.findById(userId).orElse(null);

        List<String> topCategoryIds = safeList(insight.getTopCategoryIds());
        List<String> topCategoryNames = resolveCategoryNames(topCategoryIds);

        String level = null;
        List<String> preferences = Collections.emptyList();

        if (user != null) {
            if (user.getLevel() != null) {
                level = user.getLevel().name();
            }
            if (user.getPreferences() != null) {
                preferences = user.getPreferences();
            }
        }

        String embeddingProfileHint = buildUserEmbeddingHint(
                topCategoryNames,
                safeMap(insight.getDifficultyScores()),
                safeMap(insight.getPriceRangeScores()),
                insight.getAvgBookedPrice(),
                insight.getMinBookedPrice(),
                insight.getMaxBookedPrice(),
                level,
                preferences
        );

        return UserEmbeddingPayload.builder()
                .userId(insight.getUserId())
                .topCategoryIds(topCategoryIds)
                .topCategoryNames(topCategoryNames)
                .categoryScores(safeMap(insight.getCategoryScores()))
                .difficultyScores(safeMap(insight.getDifficultyScores()))
                .priceRangeScores(safeMap(insight.getPriceRangeScores()))
                .avgBookedPrice(insight.getAvgBookedPrice())
                .minBookedPrice(insight.getMinBookedPrice())
                .maxBookedPrice(insight.getMaxBookedPrice())
                .level(level)
                .preferences(preferences)
                .embeddingProfileHint(embeddingProfileHint)
                .build();
    }

    @Override
    public void updateUserEmbedding(String userId, UpdateUserEmbeddingRequest request) {
        UserInsight insight = userInsightService.getByUserId(userId);

        insight.setEmbeddingProfileText(request.getEmbeddingProfileText());
        insight.setEmbeddingVector(request.getEmbeddingVector());
        insight.setEmbeddingUpdatedAt(Instant.now());

        userInsightService.save(insight);
    }

    private List<String> resolveCategoryNames(List<String> categoryIds) {
        if (categoryIds == null || categoryIds.isEmpty()) {
            return Collections.emptyList();
        }

        return categoryRepository.findAllById(categoryIds).stream()
                .map(Category::getName)
                .filter(Objects::nonNull)
                .distinct()
                .collect(Collectors.toList());
    }

    private List<String> safeList(List<String> values) {
        return values != null ? values : Collections.emptyList();
    }

    private Map<String, Integer> safeMap(Map<String, Integer> map) {
        return map != null ? map : Collections.emptyMap();
    }

    private String buildTemplateEmbeddingHint(
            String title,
            String description,
            List<String> categoryNames,
            String difficulty,
            BigDecimal price,
            List<String> tags
    ) {
        StringBuilder sb = new StringBuilder();

        appendLine(sb, "Activity title", title);
        appendLine(sb, "Description", description);

        if (!categoryNames.isEmpty()) {
            appendLine(sb, "Categories", String.join(", ", categoryNames));

            List<String> semanticHints = expandCategorySemanticHints(categoryNames);
            if (!semanticHints.isEmpty()) {
                appendLine(sb, "Category semantic hints", String.join(", ", semanticHints));
            }
        }

        appendLine(sb, "Difficulty", difficulty);

        if (price != null) {
            appendLine(sb, "Price", price.stripTrailingZeros().toPlainString() + " TND");
        }

        if (!tags.isEmpty()) {
            appendLine(sb, "Tags", String.join(", ", tags));
        }

        return sb.toString().trim();
    }

    private List<String> expandCategorySemanticHints(List<String> categoryNames) {
        if (categoryNames == null || categoryNames.isEmpty()) {
            return Collections.emptyList();
        }

        Map<String, List<String>> semanticMap = buildCategorySemanticMap();

        LinkedHashSet<String> hints = new LinkedHashSet<>();

        for (String categoryName : categoryNames) {
            if (categoryName == null || categoryName.isBlank()) {
                continue;
            }

            String normalized = categoryName.trim().toLowerCase(Locale.ROOT);

            for (Map.Entry<String, List<String>> entry : semanticMap.entrySet()) {
                if (normalized.contains(entry.getKey())) {
                    hints.addAll(entry.getValue());
                }
            }
        }

        return new ArrayList<>(hints);
    }

    private Map<String, List<String>> buildCategorySemanticMap() {
        Map<String, List<String>> map = new HashMap<>();

        map.put("diving", List.of(
                "scuba",
                "underwater",
                "water activity",
                "aquatic adventure",
                "sea sport",
                "marine exploration",
                "ocean experience",
                "sea adventure"
        ));

        map.put("hiking", List.of(
                "trekking",
                "randonnee",
                "randonnee",
                "nature walk",
                "mountain trail",
                "outdoor nature activity",
                "forest walk",
                "trail adventure"
        ));

        map.put("camping", List.of(
                "tent stay",
                "outdoor stay",
                "forest escape",
                "nature overnight",
                "adventure camp",
                "wild retreat"
        ));

        map.put("marathon", List.of(
                "running event",
                "endurance sport",
                "road race",
                "fitness challenge",
                "running activity"
        ));

        map.put("cycling", List.of(
                "bike ride",
                "biking adventure",
                "road cycling",
                "mountain biking",
                "outdoor cycling activity"
        ));

        map.put("kayaking", List.of(
                "paddle sport",
                "water adventure",
                "river activity",
                "sea kayaking",
                "aquatic outdoor sport"
        ));

        map.put("climbing", List.of(
                "rock climbing",
                "vertical adventure",
                "mountain sport",
                "outdoor challenge"
        ));

        map.put("desert", List.of(
                "sahara adventure",
                "sand dunes",
                "oasis trip",
                "desert experience",
                "camel ride",
                "quad adventure"
        ));

        map.put("horse", List.of(
                "horse riding",
                "equestrian activity",
                "riding experience",
                "nature ride"
        ));

        return map;
    }

    private String buildUserEmbeddingHint(
            List<String> topCategoryNames,
            Map<String, Integer> difficultyScores,
            Map<String, Integer> priceRangeScores,
            BigDecimal avgBookedPrice,
            BigDecimal minBookedPrice,
            BigDecimal maxBookedPrice,
            String level,
            List<String> preferences
    ) {
        StringBuilder sb = new StringBuilder();

        if (!topCategoryNames.isEmpty()) {
            appendLine(sb, "Top categories", String.join(", ", topCategoryNames));
        }

        if (!difficultyScores.isEmpty()) {
            String difficulties = difficultyScores.entrySet().stream()
                    .sorted((a, b) -> Integer.compare(b.getValue(), a.getValue()))
                    .map(e -> e.getKey() + " (" + e.getValue() + ")")
                    .collect(Collectors.joining(", "));
            appendLine(sb, "Preferred difficulties", difficulties);
        }

        if (!priceRangeScores.isEmpty()) {
            String priceRanges = priceRangeScores.entrySet().stream()
                    .sorted((a, b) -> Integer.compare(b.getValue(), a.getValue()))
                    .map(e -> e.getKey() + " (" + e.getValue() + ")")
                    .collect(Collectors.joining(", "));
            appendLine(sb, "Preferred price ranges", priceRanges);
        }

        if (avgBookedPrice != null) {
            appendLine(sb, "Average booked price", avgBookedPrice.stripTrailingZeros().toPlainString() + " TND");
        }

        if (minBookedPrice != null && maxBookedPrice != null) {
            appendLine(
                    sb,
                    "Usual booked price range",
                    minBookedPrice.stripTrailingZeros().toPlainString() + " to "
                            + maxBookedPrice.stripTrailingZeros().toPlainString() + " TND"
            );
        }

        appendLine(sb, "User level", level);

        if (preferences != null && !preferences.isEmpty()) {
            appendLine(sb, "Explicit preferences", String.join(", ", preferences));
        }

        return sb.toString().trim();
    }

    private void appendLine(StringBuilder sb, String label, String value) {
        if (value == null || value.isBlank()) {
            return;
        }
        sb.append(label).append(": ").append(value).append(".\n");
    }
}
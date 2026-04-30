package com.untamed.untamedbackend.assistant;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.untamed.untamedbackend.model.Difficulty;
import com.untamed.untamedbackend.model.Role;
import com.untamed.untamedbackend.model.User;
import com.untamed.untamedbackend.repository.UserRepository;
import com.untamed.untamedbackend.service.TagService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.web.client.RestTemplateBuilder;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.web.client.RestClientResponseException;
import org.springframework.web.client.RestTemplate;

import java.math.BigDecimal;
import java.time.Duration;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;

@Service
@RequiredArgsConstructor
@Slf4j
public class GeminiActivityAssistantService implements AiActivityAssistantService {

    private final AssistantProperties properties;
    private final ObjectMapper objectMapper;
    private final UserRepository userRepository;
    private final RestTemplateBuilder restTemplateBuilder;
    private final TagService tagService;

    @Override
    public GenerateActivityDraftResponse generateDraft(GenerateActivityDraftRequest request, String authEmail) {
        ensureGuide(authEmail);

        if (!StringUtils.hasText(properties.getApiKey())) {
            throw new IllegalStateException("OpenRouter API key missing");
        }

        RestTemplate restTemplate = restTemplateBuilder
                .connectTimeout(Duration.ofMillis(properties.getTimeoutMs()))
                .readTimeout(Duration.ofMillis(properties.getTimeoutMs()))
                .build();

        String url = properties.getBaseUrl() + "/chat/completions";

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.setBearerAuth(properties.getApiKey());

        String prompt = buildPrompt(request);

        ObjectNode body = objectMapper.createObjectNode();
        body.put("model", properties.getModel());
        body.put("temperature", 0.55);

        body.set("messages",
                objectMapper.createArrayNode()
                        .add(objectMapper.createObjectNode()
                                .put("role", "system")
                                .put("content", """
                                        You are an expert AI assistant for outdoor activity guides in Tunisia.
                                        Generate realistic, useful, marketable activity draft suggestions.
                                        Always return strict JSON only.
                                        Never return markdown.
                                        Never return code fences.
                                        """))
                        .add(objectMapper.createObjectNode()
                                .put("role", "user")
                                .put("content", prompt))
        );

        HttpEntity<String> entity;
        try {
            entity = new HttpEntity<>(objectMapper.writeValueAsString(body), headers);
        } catch (Exception e) {
            throw new IllegalStateException("Failed to prepare assistant request", e);
        }

        ResponseEntity<String> response;
        try {
            response = restTemplate.exchange(url, HttpMethod.POST, entity, String.class);
        } catch (RestClientResponseException e) {
            throw new IllegalStateException(
                    "OpenRouter error: status=" + e.getRawStatusCode()
                            + ", model=" + properties.getModel()
                            + ", url=" + url
                            + ", body=" + e.getResponseBodyAsString(),
                    e
            );
        } catch (Exception e) {
            throw new IllegalStateException("Assistant request failed", e);
        }

        return parseResponse(response.getBody(), request);
    }

    private void ensureGuide(String authEmail) {
        if (!StringUtils.hasText(authEmail)) {
            throw new IllegalArgumentException("Unauthorized");
        }

        User user = userRepository.findByEmail(authEmail)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));

        if (user.getRole() != Role.GUIDE) {
            throw new IllegalArgumentException("Only guides can use AI assistant");
        }
    }

    private String buildPrompt(GenerateActivityDraftRequest request) {
        return """
                Return ONLY raw valid JSON.
                Do not add explanations.
                Do not add markdown.
                Do not use ``` fences.
                Do not write text before or after the JSON.

                You are helping a guide create a strong outdoor activity draft for Tunisia.

                Required JSON format:
                {
                  "title": "string",
                  "description": "string",
                  "difficulty": "EASY | MEDIUM | HARD",
                  "tags": ["string"],
                  "semanticHints": ["string"],
                  "suggestedCategoryIds": ["string"],
                  "suggestedCategoryNames": ["string"],
                  "suggestedPriceMin": 0,
                  "suggestedPriceMax": 0,
                  "suggestedDurationMinutes": 0,
                  "suggestedCapacity": 0,
                  "highlights": ["string"],
                  "includedItems": ["string"],
                  "whatToBring": ["string"],
                  "warnings": ["string"],
                  "missingDetails": ["string"],
                  "meetingPointSuggestion": "string",
                  "sessionNoteSuggestion": "string",
                  "rationale": "string"
                }

                Tag rules:
                - Generate 4 to 8 precise lowercase tag slugs.
                - Tags must describe the real activity type, environment, effort, vibe, or requirements.
                - Use reusable slugs, not sentences.
                - Good examples:
                  running, marathon, endurance, fitness, long-distance, physically-demanding,
                  hiking, mountain, forest, waterfall, camping, desert, stargazing,
                  kayaking, sea, diving, snorkeling, quad-biking, caving,
                  beginner-friendly, family-friendly, adrenaline, relaxing, premium, budget-friendly.
                - Do NOT use vague tags like: fun, nice, cool, friends, outdoor, activity, trip, challenge.
                - Do NOT use city/place names as tags unless they describe an environment.
                - If the activity is a marathon, running race, expert run, endurance run, or long run:
                  tags MUST include running, endurance, long-distance, physically-demanding.
                  difficulty must be MEDIUM or HARD.
                  do NOT include beginner-friendly or relaxing.
                - If the input says beginner, easy, family, children, slow pace, or no experience needed:
                  beginner-friendly is allowed.
                - Otherwise, do not use beginner-friendly.

                Other rules:
                - title must be catchy, concise, and natural.
                - description must be 3 to 5 sentences and suitable for a booking page.
                - difficulty must be EASY, MEDIUM, or HARD.
                - semanticHints must contain 4 to 8 short search-oriented phrases.
                - suggestedPriceMin and suggestedPriceMax must be realistic non-negative numbers.
                - suggestedDurationMinutes and suggestedCapacity must be realistic positive integers.
                - warnings should mention uncertainty or operational risks.
                - missingDetails should mention what the guide still needs to confirm.
                - If uncertain, make conservative suggestions.
                - The location field is contextual only. Do not invent exact address facts.

                Input:
                Idea: %s
                Target audience: %s
                Vibe: %s
                Notes: %s
                Duration preference: %s
                Budget style: %s
                Selected address id: %s
                Place label: %s
                """.formatted(
                safe(request.idea()),
                safe(request.targetAudience()),
                safe(request.vibe()),
                safe(request.notes()),
                safe(request.durationPreference()),
                safe(request.budgetStyle()),
                safe(request.addressId()),
                safe(request.placeLabel())
        );
    }

    private GenerateActivityDraftResponse parseResponse(String rawBody, GenerateActivityDraftRequest request) {
        try {
            JsonNode root = objectMapper.readTree(rawBody);

            JsonNode choices = root.path("choices");
            if (!choices.isArray() || choices.isEmpty()) {
                throw new IllegalStateException("Assistant returned no choices");
            }

            String content = choices.get(0)
                    .path("message")
                    .path("content")
                    .asText(null);

            if (!StringUtils.hasText(content)) {
                throw new IllegalStateException("Assistant returned empty content");
            }

            log.info("ASSISTANT RAW CONTENT = {}", content);

            JsonNode json = extractJsonFromContent(content);

            String title = trimToNull(json.path("title").asText(null));
            String description = trimToNull(json.path("description").asText(null));

            if (!StringUtils.hasText(title)) {
                throw new IllegalStateException("Assistant did not return title");
            }

            if (!StringUtils.hasText(description)) {
                throw new IllegalStateException("Assistant did not return description");
            }

            Difficulty difficulty = parseDifficulty(json.path("difficulty").asText(null));

            List<String> rawAiTags = cleanList(toList(json.path("tags")), 8);
            List<String> semanticHints = cleanList(toList(json.path("semanticHints")), 8);

            List<String> suggestedCategoryIds = cleanList(toList(json.path("suggestedCategoryIds")), 5);
            List<String> suggestedCategoryNames = cleanList(toList(json.path("suggestedCategoryNames")), 5);

            BigDecimal suggestedPriceMin = parseBigDecimal(json.path("suggestedPriceMin"));
            BigDecimal suggestedPriceMax = parseBigDecimal(json.path("suggestedPriceMax"));

            if (suggestedPriceMin != null && suggestedPriceMin.compareTo(BigDecimal.ZERO) < 0) {
                suggestedPriceMin = BigDecimal.ZERO;
            }

            if (suggestedPriceMax != null && suggestedPriceMax.compareTo(BigDecimal.ZERO) < 0) {
                suggestedPriceMax = BigDecimal.ZERO;
            }

            if (suggestedPriceMin != null && suggestedPriceMax != null
                    && suggestedPriceMax.compareTo(suggestedPriceMin) < 0) {
                suggestedPriceMax = suggestedPriceMin;
            }

            Integer suggestedDurationMinutes = parsePositiveInt(json.path("suggestedDurationMinutes"));
            Integer suggestedCapacity = parsePositiveInt(json.path("suggestedCapacity"));

            List<String> highlights = cleanList(toList(json.path("highlights")), 8);
            List<String> includedItems = cleanList(toList(json.path("includedItems")), 8);
            List<String> whatToBring = cleanList(toList(json.path("whatToBring")), 8);
            List<String> warnings = cleanList(toList(json.path("warnings")), 8);
            List<String> missingDetails = cleanList(toList(json.path("missingDetails")), 8);

            String meetingPointSuggestion = trimToNull(json.path("meetingPointSuggestion").asText(null));
            String sessionNoteSuggestion = trimToNull(json.path("sessionNoteSuggestion").asText(null));
            String rationale = trimToNull(json.path("rationale").asText(null));

            if (rawAiTags.isEmpty()) {
                rawAiTags = fallbackTags(request);
            }

            String allInput = (
                    safeLower(request.idea()) + " " +
                            safeLower(request.vibe()) + " " +
                            safeLower(request.notes()) + " " +
                            safeLower(request.durationPreference()) + " " +
                            safeLower(request.targetAudience())
            );

            boolean isRunningEndurance =
                    allInput.contains("marathon")
                            || allInput.contains("running")
                            || allInput.contains("run ")
                            || allInput.contains("endurance")
                            || allInput.contains("expert");

            if (isRunningEndurance) {
                Set<String> corrected = new LinkedHashSet<>(rawAiTags);

                corrected.remove("beginner-friendly");
                corrected.remove("relaxing");
                corrected.remove("friends");
                corrected.remove("challenge");

                corrected.add("running");
                corrected.add("endurance");
                corrected.add("long-distance");
                corrected.add("physically-demanding");
                corrected.add("fitness");

                if (allInput.contains("marathon")) {
                    corrected.add("marathon");
                }

                rawAiTags = corrected.stream().limit(8).toList();

                if (difficulty == Difficulty.EASY) {
                    difficulty = Difficulty.HARD;
                }
            }

            if (semanticHints.isEmpty()) {
                semanticHints = fallbackSemanticHints(request);
            }

            if (warnings.isEmpty()) {
                warnings = List.of("Review logistics, pricing, and exact meeting instructions before publishing.");
            }

            if (missingDetails.isEmpty()) {
                missingDetails = fallbackMissingDetails(request);
            }

            if (suggestedDurationMinutes == null) {
                suggestedDurationMinutes = 180;
            }

            if (suggestedCapacity == null) {
                suggestedCapacity = 10;
            }

            if (difficulty == null) {
                difficulty = Difficulty.MEDIUM;
            }

            List<String> finalTags = tagService.processAiTags(rawAiTags);

            return new GenerateActivityDraftResponse(
                    title,
                    description,
                    difficulty,
                    finalTags,
                    semanticHints,
                    suggestedCategoryIds,
                    suggestedCategoryNames,
                    suggestedPriceMin,
                    suggestedPriceMax,
                    suggestedDurationMinutes,
                    suggestedCapacity,
                    highlights,
                    includedItems,
                    whatToBring,
                    warnings,
                    missingDetails,
                    meetingPointSuggestion,
                    sessionNoteSuggestion,
                    rationale
            );

        } catch (Exception e) {
            log.warn("Failed to parse assistant response: {}", e.getMessage(), e);
            return fallbackResponse(request);
        }
    }

    private JsonNode extractJsonFromContent(String content) throws Exception {
        String text = content.trim();

        if (text.startsWith("```json")) {
            text = text.substring(7).trim();
        } else if (text.startsWith("```")) {
            text = text.substring(3).trim();
        }

        if (text.endsWith("```")) {
            text = text.substring(0, text.length() - 3).trim();
        }

        int firstBrace = text.indexOf('{');
        int lastBrace = text.lastIndexOf('}');

        if (firstBrace >= 0 && lastBrace > firstBrace) {
            text = text.substring(firstBrace, lastBrace + 1);
        }

        return objectMapper.readTree(text);
    }

    private GenerateActivityDraftResponse fallbackResponse(GenerateActivityDraftRequest request) {
        String baseTitle = trimToNull(request.idea());

        if (!StringUtils.hasText(baseTitle)) {
            baseTitle = "Guided outdoor experience";
        }

        String title = capitalize(shorten(baseTitle, 60));

        StringBuilder description = new StringBuilder("A guided outdoor experience");

        if (StringUtils.hasText(request.targetAudience())) {
            description.append(" designed for ").append(request.targetAudience().trim());
        }

        if (StringUtils.hasText(request.placeLabel())) {
            description.append(" around ").append(request.placeLabel().trim());
        }

        description.append(". It offers a practical and enjoyable way to discover the destination with the support of a guide. ");
        description.append("Review the operational details, inclusions, and exact logistics before publishing.");

        List<String> finalTags = tagService.processAiTags(fallbackTags(request));

        return new GenerateActivityDraftResponse(
                title,
                description.toString(),
                Difficulty.MEDIUM,
                finalTags,
                fallbackSemanticHints(request),
                List.of(),
                List.of(),
                BigDecimal.ZERO,
                BigDecimal.ZERO,
                180,
                10,
                List.of("Guided experience", "Outdoor discovery"),
                List.of(),
                List.of("Comfortable shoes", "Water"),
                List.of("AI fallback draft used. Review all fields before saving."),
                fallbackMissingDetails(request),
                "Set a clear and easy-to-find meeting point for participants.",
                "Mention what participants should bring, the pace of the experience, and who it is suitable for.",
                "Fallback response generated because the assistant output could not be parsed reliably."
        );
    }

    private List<String> fallbackTags(GenerateActivityDraftRequest request) {
        Set<String> tags = new LinkedHashSet<>();

        String idea = safeLower(request.idea());
        String vibe = safeLower(request.vibe());
        String notes = safeLower(request.notes());
        String audience = safeLower(request.targetAudience());

        String all = idea + " " + vibe + " " + notes + " " + audience;

        if (all.contains("run") || all.contains("marathon") || all.contains("jog") || all.contains("endurance")) {
            tags.add("running");
            tags.add("fitness");
            tags.add("endurance");
            tags.add("physically-demanding");
            tags.add("long-distance");

            if (all.contains("marathon")) {
                tags.add("marathon");
            }
        }

        if (all.contains("hike") || all.contains("trail") || all.contains("trek")) {
            tags.add("hiking");
            tags.add("mountain");
            tags.add("adventure");
        }

        if (all.contains("camp")) {
            tags.add("camping");
        }

        if (all.contains("waterfall")) {
            tags.add("waterfall");
        }

        if (all.contains("forest")) {
            tags.add("forest");
        }

        if (all.contains("sea") || all.contains("beach") || all.contains("kayak") || all.contains("boat")) {
            tags.add("sea");
            tags.add("beach");
        }

        if (all.contains("desert")) {
            tags.add("desert");
        }

        if (all.contains("family")) {
            tags.add("family-friendly");
        }

        if (all.contains("beginner") || all.contains("easy")) {
            tags.add("beginner-friendly");
        }

        if (tags.isEmpty()) {
            tags.add("adventure");
        }

        return tags.stream().limit(8).toList();
    }

    private List<String> fallbackSemanticHints(GenerateActivityDraftRequest request) {
        Set<String> hints = new LinkedHashSet<>();
        hints.add("guided outdoor activity");
        hints.add("nature experience");
        hints.add("local adventure");

        if (StringUtils.hasText(request.idea())) {
            hints.add(request.idea().trim().toLowerCase(Locale.ROOT));
        }

        if (StringUtils.hasText(request.targetAudience())) {
            hints.add(request.targetAudience().trim().toLowerCase(Locale.ROOT));
        }

        if (StringUtils.hasText(request.vibe())) {
            hints.add(request.vibe().trim().toLowerCase(Locale.ROOT));
        }

        if (StringUtils.hasText(request.placeLabel())) {
            hints.add(request.placeLabel().trim().toLowerCase(Locale.ROOT));
        }

        return hints.stream().limit(8).toList();
    }

    private List<String> fallbackMissingDetails(GenerateActivityDraftRequest request) {
        List<String> missing = new ArrayList<>();

        if (!StringUtils.hasText(request.placeLabel()) && !StringUtils.hasText(request.addressId())) {
            missing.add("Select a precise address.");
        }

        if (!StringUtils.hasText(request.durationPreference())) {
            missing.add("Confirm the target duration.");
        }

        if (!StringUtils.hasText(request.budgetStyle())) {
            missing.add("Confirm the intended price positioning.");
        }

        missing.add("Review capacity, inclusions, and meeting point.");

        return missing;
    }

    private Difficulty parseDifficulty(String value) {
        if (!StringUtils.hasText(value)) {
            return Difficulty.MEDIUM;
        }

        try {
            return Difficulty.valueOf(value.trim().toUpperCase(Locale.ROOT));
        } catch (Exception e) {
            return Difficulty.MEDIUM;
        }
    }

    private BigDecimal parseBigDecimal(JsonNode node) {
        try {
            if (node == null || node.isMissingNode() || node.isNull()) {
                return null;
            }

            if (node.isNumber()) {
                return node.decimalValue();
            }

            String text = trimToNull(node.asText(null));

            if (!StringUtils.hasText(text)) {
                return null;
            }

            return new BigDecimal(text);
        } catch (Exception e) {
            return null;
        }
    }

    private Integer parsePositiveInt(JsonNode node) {
        try {
            if (node == null || node.isMissingNode() || node.isNull()) {
                return null;
            }

            int value = node.isNumber() ? node.asInt() : Integer.parseInt(node.asText());

            return value > 0 ? value : null;
        } catch (Exception e) {
            return null;
        }
    }

    private List<String> toList(JsonNode node) {
        if (node == null || !node.isArray()) {
            return List.of();
        }

        List<String> list = new ArrayList<>();

        for (JsonNode n : node) {
            String value = trimToNull(n.asText(null));

            if (value != null) {
                list.add(value);
            }
        }

        return list;
    }

    private List<String> cleanList(List<String> input, int maxSize) {
        if (input == null || input.isEmpty()) {
            return List.of();
        }

        Set<String> cleaned = new LinkedHashSet<>();

        for (String item : input) {
            String value = trimToNull(item);

            if (value != null) {
                cleaned.add(value);
            }

            if (cleaned.size() >= maxSize) {
                break;
            }
        }

        return List.copyOf(cleaned);
    }

    private String safe(String value) {
        return StringUtils.hasText(value) ? value.trim() : "not specified";
    }

    private String safeLower(String value) {
        return StringUtils.hasText(value) ? value.trim().toLowerCase(Locale.ROOT) : "";
    }

    private String trimToNull(String value) {
        if (!StringUtils.hasText(value)) {
            return null;
        }

        return value.trim();
    }

    private String shorten(String value, int max) {
        if (value == null || value.length() <= max) {
            return value;
        }

        return value.substring(0, max).trim();
    }

    private String capitalize(String value) {
        if (!StringUtils.hasText(value)) {
            return value;
        }

        return value.substring(0, 1).toUpperCase(Locale.ROOT) + value.substring(1);
    }
}
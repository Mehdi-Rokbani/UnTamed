package com.untamed.untamedbackend.smartsearch.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.untamed.untamedbackend.smartsearch.dto.AiSearchPlan;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.Arrays;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;

@Slf4j
@Service
public class AiQueryUnderstandingServiceImpl implements AiQueryUnderstandingService {

    private final ObjectMapper objectMapper;
    private final HttpClient httpClient;

    @Value("${app.ai.openrouter.api-key}")
    private String apiKey;

    @Value("${app.ai.openrouter.model:openrouter/free}")
    private String model;

    @Value("${app.ai.openrouter.base-url:https://openrouter.ai/api/v1}")
    private String baseUrl;

    @Value("${app.ai.openrouter.timeout-ms:20000}")
    private int timeoutMs;

    public AiQueryUnderstandingServiceImpl(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
        this.httpClient = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(20))
                .build();
    }

    @Override
    public AiSearchPlan buildPlan(String rawQuery) {
        String normalized = normalize(rawQuery);

        if (normalized.isBlank()) {
            throw new IllegalArgumentException("rawQuery must not be blank");
        }

        try {
            AiSearchPlan plan = callOpenRouter(normalized);

            if (plan == null) {
                throw new IllegalStateException("OpenRouter returned null plan");
            }

            AiSearchPlan sanitized = sanitizePlan(plan, normalized);

            log.info("🧠 OpenRouter AI search plan built: query='{}', intent={}, strictness={}, concepts={}, mustIncludeAny={}",
                    normalized,
                    sanitized.getIntent(),
                    sanitized.getStrictness(),
                    sanitized.getConcepts(),
                    sanitized.getMustIncludeAny());

            return sanitized;

        } catch (Exception e) {
            log.warn("OpenRouter AI query understanding failed for query='{}': {}", normalized, e.getMessage());

            try {
                AiSearchPlan fallback = buildHeuristicFallback(normalized);

                log.info("🛟 Heuristic fallback search plan used: query='{}', intent={}, strictness={}, concepts={}, mustIncludeAny={}",
                        normalized,
                        fallback.getIntent(),
                        fallback.getStrictness(),
                        fallback.getConcepts(),
                        fallback.getMustIncludeAny());

                return fallback;
            } catch (Exception fallbackError) {
                log.warn("Heuristic fallback failed for query='{}': {}", normalized, fallbackError.getMessage());

                return AiSearchPlan.builder()
                        .normalizedQuery(normalized)
                        .intent("GENERIC")
                        .strictness("MEDIUM")
                        .concepts(List.of(normalized))
                        .mustIncludeAny(List.of())
                        .preferredTags(List.of())
                        .preferredDifficulty(null)
                        .build();
            }
        }
    }

    private AiSearchPlan callOpenRouter(String normalizedQuery) throws IOException, InterruptedException {
        String systemPrompt = """
                You are a search-query understanding system for an outdoor activities platform.

                Convert the user query into a structured JSON search plan.

                Rules:
                - Output valid JSON only.
                - Do not wrap the JSON in markdown.
                - Do not explain anything.
                - intent must be exactly one of: GENERIC, WATER, NATURE, RUNNING, DESERT
                - strictness must be exactly one of: LOW, MEDIUM, HIGH
                - concepts should include the user query and semantically related concepts
                - mustIncludeAny should contain only strong lexical anchors when appropriate
                - preferredTags should be short tag-like concepts
                - preferredDifficulty must be EASY, MEDIUM, HARD, or null
                - Keep arrays short and useful
                - Be practical for search ranking, not poetic

                JSON schema:
                {
                  "normalizedQuery": "string",
                  "intent": "GENERIC|WATER|NATURE|RUNNING|DESERT",
                  "strictness": "LOW|MEDIUM|HIGH",
                  "concepts": ["string"],
                  "mustIncludeAny": ["string"],
                  "preferredTags": ["string"],
                  "preferredDifficulty": "EASY|MEDIUM|HARD|null"
                }
                """;

        ObjectNodeBuilder body = new ObjectNodeBuilder(objectMapper)
                .put("model", model)
                .put("temperature", 0.1)
                .put("max_tokens", 300)
                .putArray("messages")
                .addObject()
                .put("role", "system")
                .put("content", systemPrompt)
                .end()
                .addObject()
                .put("role", "user")
                .put("content", normalizedQuery)
                .end()
                .endArray()
                .putObject("response_format")
                .put("type", "json_object")
                .end();

        String requestBody = body.build();

        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(trimTrailingSlash(baseUrl) + "/chat/completions"))
                .timeout(Duration.ofMillis(timeoutMs))
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + apiKey)
                .header(HttpHeaders.CONTENT_TYPE, MediaType.APPLICATION_JSON_VALUE)
                .header("HTTP-Referer", "https://untamed.local")
                .header("X-Title", "UnTamed Smart Search")
                .POST(HttpRequest.BodyPublishers.ofString(requestBody))
                .build();

        HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());

        if (response.statusCode() < 200 || response.statusCode() >= 300) {
            throw new IllegalStateException("OpenRouter HTTP " + response.statusCode() + ": " + response.body());
        }

        JsonNode root = objectMapper.readTree(response.body());
        JsonNode contentNode = root.path("choices").path(0).path("message").path("content");

        if (contentNode.isMissingNode() || contentNode.isNull() || contentNode.asText().isBlank()) {
            throw new IllegalStateException("OpenRouter response content is empty");
        }

        String content = contentNode.asText();
        return objectMapper.readValue(content, AiSearchPlan.class);
    }

    private AiSearchPlan sanitizePlan(AiSearchPlan rawPlan, String originalQuery) {
        String normalizedQuery = normalize(
                rawPlan != null && rawPlan.getNormalizedQuery() != null && !rawPlan.getNormalizedQuery().isBlank()
                        ? rawPlan.getNormalizedQuery()
                        : originalQuery
        );

        String intent = sanitizeIntent(rawPlan != null ? rawPlan.getIntent() : null);
        String strictness = sanitizeStrictness(rawPlan != null ? rawPlan.getStrictness() : null);
        String preferredDifficulty = sanitizeDifficulty(rawPlan != null ? rawPlan.getPreferredDifficulty() : null);

        Set<String> concepts = new LinkedHashSet<>();
        concepts.add(normalizedQuery);

        if (rawPlan != null && rawPlan.getConcepts() != null) {
            rawPlan.getConcepts().stream()
                    .filter(s -> s != null && !s.isBlank())
                    .map(this::normalizeLower)
                    .forEach(concepts::add);
        }

        Set<String> mustIncludeAny = new LinkedHashSet<>();
        if (rawPlan != null && rawPlan.getMustIncludeAny() != null) {
            rawPlan.getMustIncludeAny().stream()
                    .filter(s -> s != null && !s.isBlank())
                    .map(this::normalizeLower)
                    .forEach(mustIncludeAny::add);
        }

        List<String> preferredTags = rawPlan != null && rawPlan.getPreferredTags() != null
                ? rawPlan.getPreferredTags().stream()
                .filter(s -> s != null && !s.isBlank())
                .map(this::normalizeLower)
                .distinct()
                .limit(8)
                .toList()
                : List.of();

        return AiSearchPlan.builder()
                .normalizedQuery(normalizedQuery)
                .intent(intent)
                .strictness(strictness)
                .concepts(List.copyOf(concepts))
                .mustIncludeAny(List.copyOf(mustIncludeAny))
                .preferredTags(preferredTags)
                .preferredDifficulty(preferredDifficulty)
                .build();
    }

    private String sanitizeIntent(String intent) {
        if (intent == null) return "GENERIC";
        String value = intent.trim().toUpperCase(Locale.ROOT);
        return switch (value) {
            case "WATER", "NATURE", "RUNNING", "DESERT", "GENERIC" -> value;
            default -> "GENERIC";
        };
    }

    private String sanitizeStrictness(String strictness) {
        if (strictness == null) return "MEDIUM";
        String value = strictness.trim().toUpperCase(Locale.ROOT);
        return switch (value) {
            case "LOW", "MEDIUM", "HIGH" -> value;
            default -> "MEDIUM";
        };
    }

    private String sanitizeDifficulty(String difficulty) {
        if (difficulty == null || difficulty.isBlank()) return null;
        String value = difficulty.trim().toUpperCase(Locale.ROOT);
        return switch (value) {
            case "EASY", "MEDIUM", "HARD" -> value;
            default -> null;
        };
    }

    private AiSearchPlan buildHeuristicFallback(String normalized) {
        String intent = detectIntent(normalized);
        String strictness = detectStrictness(normalized, intent);

        Set<String> concepts = buildConcepts(normalized, intent);
        Set<String> mustIncludeAny = buildMustIncludeAny(normalized, intent);
        List<String> preferredTags = buildPreferredTags(intent);

        return AiSearchPlan.builder()
                .normalizedQuery(normalized)
                .intent(intent)
                .strictness(strictness)
                .concepts(List.copyOf(concepts))
                .mustIncludeAny(List.copyOf(mustIncludeAny))
                .preferredTags(preferredTags)
                .preferredDifficulty(null)
                .build();
    }

    private String normalize(String rawQuery) {
        return rawQuery == null ? "" : rawQuery.trim();
    }

    private String normalizeLower(String value) {
        return value == null ? "" : value.toLowerCase(Locale.ROOT).trim();
    }

    private List<String> splitTokens(String value) {
        if (value == null || value.isBlank()) {
            return List.of();
        }

        return Arrays.stream(value.split("\\s+"))
                .map(String::trim)
                .filter(token -> !token.isBlank())
                .toList();
    }

    private String detectIntent(String query) {
        String q = normalizeLower(query);

        if (containsAny(q,
                "water", "sea", "diving", "scuba", "underwater", "aquatic",
                "marine", "ocean", "kayak", "kayaking", "paddle", "snorkeling", "snorkelling"
        )) {
            return "WATER";
        }

        if (containsAny(q,
                "hiking", "hike", "trail", "mountain", "trek", "trekking",
                "walk", "randonnee", "randonnée", "camping", "forest"
        )) {
            return "NATURE";
        }

        if (containsAny(q,
                "run", "running", "marathon", "race", "fitness", "endurance"
        )) {
            return "RUNNING";
        }

        if (containsAny(q,
                "desert", "sahara", "dune", "dunes", "camel", "oasis", "quad"
        )) {
            return "DESERT";
        }

        return "GENERIC";
    }

    private String detectStrictness(String query, String intent) {
        int wordCount = splitTokens(query).size();

        if ("GENERIC".equals(intent)) {
            if (wordCount <= 1) return "LOW";
            if (wordCount == 2) return "MEDIUM";
            return "MEDIUM";
        }

        if (wordCount <= 1) return "MEDIUM";
        if (wordCount <= 3) return "HIGH";
        return "MEDIUM";
    }

    private Set<String> buildConcepts(String query, String intent) {
        Set<String> concepts = new LinkedHashSet<>();
        String normalized = normalizeLower(query);

        concepts.add(normalized);
        concepts.addAll(splitTokens(normalized));

        switch (intent) {
            case "WATER" -> {
                concepts.add("water");
                concepts.add("sea");
                concepts.add("marine");
                concepts.add("underwater");

                if (containsAny(normalized, "scuba", "diving")) {
                    concepts.add("scuba");
                    concepts.add("diving");
                    concepts.add("dive");
                }

                if (containsAny(normalized, "snorkeling", "snorkelling")) {
                    concepts.add("snorkeling");
                    concepts.add("snorkelling");
                }

                if (containsAny(normalized, "kayak", "kayaking", "paddle")) {
                    concepts.add("kayak");
                    concepts.add("kayaking");
                    concepts.add("paddle");
                }
            }
            case "NATURE" -> {
                concepts.add("nature");
                concepts.add("trail");
                concepts.add("outdoor");

                if (containsAny(normalized, "hike", "hiking", "trek", "trekking")) {
                    concepts.add("hike");
                    concepts.add("hiking");
                    concepts.add("trek");
                    concepts.add("trekking");
                }

                concepts.add("forest");
                concepts.add("mountain");
                concepts.add("walk");
            }
            case "RUNNING" -> {
                concepts.add("running");
                concepts.add("race");
                concepts.add("endurance");

                if (containsAny(normalized, "marathon")) {
                    concepts.add("marathon");
                }
            }
            case "DESERT" -> {
                concepts.add("desert");
                concepts.add("sahara");
                concepts.add("dunes");
                concepts.add("oasis");

                if (containsAny(normalized, "camel")) {
                    concepts.add("camel");
                }

                if (containsAny(normalized, "quad")) {
                    concepts.add("quad");
                }

                concepts.add("ksar");
                concepts.add("ghilane");
            }
            default -> {
            }
        }

        return concepts.stream()
                .map(this::normalizeLower)
                .filter(s -> !s.isBlank())
                .collect(LinkedHashSet::new, Set::add, Set::addAll);
    }

    private Set<String> buildMustIncludeAny(String query, String intent) {
        Set<String> mustInclude = new LinkedHashSet<>();
        String normalized = normalizeLower(query);
        List<String> tokens = splitTokens(normalized);

        if ("GENERIC".equals(intent)) {
            return mustInclude;
        }

        for (String token : tokens) {
            if (token.length() >= 4) {
                mustInclude.add(token);
            }
        }

        switch (intent) {
            case "WATER" -> {
                if (containsAny(normalized, "scuba", "diving")) {
                    mustInclude.add("scuba");
                    mustInclude.add("diving");
                    mustInclude.add("underwater");
                }
            }
            case "DESERT" -> {
                if (containsAny(normalized, "camel")) {
                    mustInclude.add("camel");
                    mustInclude.add("desert");
                    mustInclude.add("sahara");
                } else if (containsAny(normalized, "sahara")) {
                    mustInclude.add("sahara");
                    mustInclude.add("desert");
                } else if (containsAny(normalized, "desert")) {
                    mustInclude.add("desert");
                    mustInclude.add("sahara");
                }
            }
            default -> {
            }
        }

        return mustInclude.stream()
                .map(this::normalizeLower)
                .filter(s -> !s.isBlank())
                .collect(LinkedHashSet::new, Set::add, Set::addAll);
    }

    private List<String> buildPreferredTags(String intent) {
        return switch (intent) {
            case "WATER" -> List.of("water", "marine", "diving");
            case "NATURE" -> List.of("nature", "trail", "outdoors");
            case "RUNNING" -> List.of("running", "race", "fitness");
            case "DESERT" -> List.of("desert", "adventure", "outdoors");
            default -> List.of();
        };
    }

    private boolean containsAny(String text, String... terms) {
        for (String term : terms) {
            if (text.contains(term.toLowerCase(Locale.ROOT))) {
                return true;
            }
        }
        return false;
    }

    private String trimTrailingSlash(String value) {
        if (value == null || value.isBlank()) {
            return "";
        }
        return value.endsWith("/") ? value.substring(0, value.length() - 1) : value;
    }

    /**
     * Tiny fluent JSON builder to keep the request body readable.
     */
    private static final class ObjectNodeBuilder {
        private final ObjectMapper mapper;
        private final JsonNode root;
        private JsonNode current;
        private final java.util.Deque<JsonNode> stack = new java.util.ArrayDeque<>();

        ObjectNodeBuilder(ObjectMapper mapper) {
            this.mapper = mapper;
            this.root = mapper.createObjectNode();
            this.current = root;
        }

        ObjectNodeBuilder put(String field, String value) {
            ((com.fasterxml.jackson.databind.node.ObjectNode) current).put(field, value);
            return this;
        }

        ObjectNodeBuilder put(String field, double value) {
            ((com.fasterxml.jackson.databind.node.ObjectNode) current).put(field, value);
            return this;
        }

        ObjectNodeBuilder put(String field, int value) {
            ((com.fasterxml.jackson.databind.node.ObjectNode) current).put(field, value);
            return this;
        }

        ObjectNodeBuilder putObject(String field) {
            JsonNode child = ((com.fasterxml.jackson.databind.node.ObjectNode) current).putObject(field);
            stack.push(current);
            current = child;
            return this;
        }

        ObjectNodeBuilder putArray(String field) {
            JsonNode child = ((com.fasterxml.jackson.databind.node.ObjectNode) current).putArray(field);
            stack.push(current);
            current = child;
            return this;
        }

        ObjectNodeBuilder addObject() {
            JsonNode child = ((com.fasterxml.jackson.databind.node.ArrayNode) current).addObject();
            stack.push(current);
            current = child;
            return this;
        }

        ObjectNodeBuilder end() {
            current = stack.pop();
            return this;
        }

        ObjectNodeBuilder endArray() {
            current = stack.pop();
            return this;
        }

        String build() throws IOException {
            return mapper.writeValueAsString(root);
        }
    }
}
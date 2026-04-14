package com.untamed.untamedbackend.assistant;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.untamed.untamedbackend.model.Difficulty;
import com.untamed.untamedbackend.model.Role;
import com.untamed.untamedbackend.model.User;
import com.untamed.untamedbackend.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.web.client.RestTemplateBuilder;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.web.client.RestClientResponseException;
import org.springframework.web.client.RestTemplate;

import java.time.Duration;
import java.util.*;

@Service
@RequiredArgsConstructor
public class GeminiActivityAssistantService implements AiActivityAssistantService {

    private final AssistantProperties properties;
    private final ObjectMapper objectMapper;
    private final UserRepository userRepository;
    private final RestTemplateBuilder restTemplateBuilder;

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

        body.set("messages",
                objectMapper.createArrayNode()
                        .add(objectMapper.createObjectNode()
                                .put("role", "user")
                                .put("content", prompt))
        );

        body.put("temperature", 0.5);

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

        return parseResponse(response.getBody());
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
            You are an expert assistant for an outdoor activities platform in Tunisia.

            Return ONLY raw valid JSON.
            Do not add explanations.
            Do not add markdown.
            Do not use ``` fences.
            Do not write any text before or after the JSON.

            Required JSON format:
            {
              "title": "string",
              "description": "string",
              "difficulty": "EASY | MEDIUM | HARD",
              "tags": ["string"],
              "semanticHints": ["string"]
            }

            Rules:
            - Title must be catchy, concise, and natural.
            - Description must be 3 to 5 sentences.
            - tags must contain 4 to 8 short lowercase tags.
            - semanticHints must contain 4 to 8 short search-oriented phrases.

            Idea: %s
            Place: %s
            Audience: %s
            Vibe: %s
            Notes: %s
            """.formatted(
                safe(request.idea()),
                safe(request.place()),
                safe(request.targetAudience()),
                safe(request.vibe()),
                safe(request.notes())
        );
    }

    private String safe(String value) {
        return StringUtils.hasText(value) ? value : "not specified";
    }

    private GenerateActivityDraftResponse parseResponse(String rawBody) {
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

            System.out.println("ASSISTANT RAW CONTENT = " + content);
            JsonNode json = extractJsonFromContent(content);

            String title = json.path("title").asText(null);
            String description = json.path("description").asText(null);
            Difficulty difficulty = parseDifficulty(json.path("difficulty").asText(null));
            List<String> tags = toList(json.path("tags"));
            List<String> semanticHints = toList(json.path("semanticHints"));

            if (!StringUtils.hasText(title)) {
                throw new IllegalStateException("Assistant did not return title");
            }
            if (!StringUtils.hasText(description)) {
                throw new IllegalStateException("Assistant did not return description");
            }

            return new GenerateActivityDraftResponse(
                    title.trim(),
                    description.trim(),
                    difficulty != null ? difficulty : Difficulty.MEDIUM,
                    tags,
                    semanticHints
            );

        } catch (Exception e) {
            throw new IllegalStateException("Failed to parse assistant response", e);
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

    private Difficulty parseDifficulty(String value) {
        try {
            return Difficulty.valueOf(value.toUpperCase());
        } catch (Exception e) {
            return Difficulty.MEDIUM;
        }
    }

    private List<String> toList(JsonNode node) {
        if (!node.isArray()) return List.of();

        List<String> list = new ArrayList<>();
        for (JsonNode n : node) {
            list.add(n.asText());
        }
        return list;
    }
}
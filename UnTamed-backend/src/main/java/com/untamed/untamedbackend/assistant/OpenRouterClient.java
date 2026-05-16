package com.untamed.untamedbackend.assistant;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.web.client.RestTemplateBuilder;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import org.springframework.web.client.RestClientResponseException;
import org.springframework.web.client.RestTemplate;

import java.time.Duration;
import java.util.List;

@Component
@RequiredArgsConstructor
public class OpenRouterClient {

    private final AssistantProperties properties;
    private final ObjectMapper objectMapper;
    private final RestTemplateBuilder restTemplateBuilder;

    public OpenRouterResult chat(
            String model,
            double temperature,
            int maxTokens,
            List<OpenRouterMessage> messages
    ) {
        if (!StringUtils.hasText(properties.getApiKey())) {
            throw new OpenRouterException("OpenRouter API key is missing");
        }
        if (!StringUtils.hasText(model)) {
            throw new OpenRouterException("OpenRouter model is missing");
        }
        if (messages == null || messages.isEmpty()) {
            throw new OpenRouterException("OpenRouter messages are missing");
        }

        RestTemplate restTemplate = restTemplateBuilder
                .connectTimeout(Duration.ofMillis(properties.getTimeoutMs()))
                .readTimeout(Duration.ofMillis(properties.getTimeoutMs()))
                .build();

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.setBearerAuth(properties.getApiKey());

        ObjectNode body = objectMapper.createObjectNode();
        body.put("model", model);
        body.put("temperature", temperature);
        body.put("max_tokens", maxTokens);

        ArrayNode messageNodes = objectMapper.createArrayNode();
        for (OpenRouterMessage message : messages) {
            if (message == null || !StringUtils.hasText(message.role()) || !StringUtils.hasText(message.content())) {
                continue;
            }
            messageNodes.add(objectMapper.createObjectNode()
                    .put("role", message.role().trim())
                    .put("content", message.content().trim()));
        }
        body.set("messages", messageNodes);

        String requestBody;
        try {
            requestBody = objectMapper.writeValueAsString(body);
        } catch (Exception e) {
            throw new OpenRouterException("Failed to prepare OpenRouter request", e);
        }

        try {
            ResponseEntity<String> response = restTemplate.exchange(
                    trimTrailingSlash(properties.getBaseUrl()) + "/chat/completions",
                    HttpMethod.POST,
                    new HttpEntity<>(requestBody, headers),
                    String.class
            );
            return parseResponse(response.getBody(), model);
        } catch (RestClientResponseException e) {
            throw new OpenRouterException("OpenRouter request failed with status " + e.getRawStatusCode(), e);
        } catch (Exception e) {
            throw new OpenRouterException("OpenRouter request failed", e);
        }
    }

    private OpenRouterResult parseResponse(String rawBody, String fallbackModel) {
        try {
            JsonNode root = objectMapper.readTree(rawBody);
            String content = root.path("choices").path(0).path("message").path("content").asText(null);
            String usedModel = root.path("model").asText(fallbackModel);

            if (!StringUtils.hasText(content)) {
                throw new OpenRouterException("OpenRouter returned an empty response");
            }

            return new OpenRouterResult(content.trim(), usedModel);
        } catch (OpenRouterException e) {
            throw e;
        } catch (Exception e) {
            throw new OpenRouterException("Failed to parse OpenRouter response", e);
        }
    }

    private String trimTrailingSlash(String value) {
        if (!StringUtils.hasText(value)) {
            return "";
        }
        return value.endsWith("/") ? value.substring(0, value.length() - 1) : value;
    }

    public record OpenRouterMessage(String role, String content) {}

    public record OpenRouterResult(String content, String model) {}

    public static class OpenRouterException extends RuntimeException {
        public OpenRouterException(String message) {
            super(message);
        }

        public OpenRouterException(String message, Throwable cause) {
            super(message, cause);
        }
    }
}

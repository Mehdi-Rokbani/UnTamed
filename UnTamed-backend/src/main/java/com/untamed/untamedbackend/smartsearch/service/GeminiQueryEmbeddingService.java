package com.untamed.untamedbackend.smartsearch.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;

@Service
@RequiredArgsConstructor
public class GeminiQueryEmbeddingService implements QueryEmbeddingService {

    private final ObjectMapper objectMapper;

    @Value("${app.ai.gemini.api-key}")
    private String apiKey;

    @Value("${app.ai.gemini.embedding-model:gemini-embedding-001}")
    private String embeddingModel;

    @Value("${app.ai.gemini.base-url:https://generativelanguage.googleapis.com}")
    private String baseUrl;

    private final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(15))
            .build();

    @Override
    public List<Double> embedQuery(String query) {
        String normalizedQuery = query == null ? "" : query.trim();
        if (normalizedQuery.isEmpty()) {
            throw new IllegalArgumentException("query must not be blank");
        }

        try {
            String requestBody = buildRequestBody(normalizedQuery);
            String endpoint = buildEndpoint();

            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(endpoint))
                    .timeout(Duration.ofSeconds(30))
                    .header(HttpHeaders.CONTENT_TYPE, MediaType.APPLICATION_JSON_VALUE)
                    .header("x-goog-api-key", apiKey)
                    .POST(HttpRequest.BodyPublishers.ofString(requestBody))
                    .build();

            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());

            if (response.statusCode() < 200 || response.statusCode() >= 300) {
                throw new IllegalStateException(
                        "Gemini embedding request failed with status " + response.statusCode() + ": " + response.body()
                );
            }

            return extractEmbedding(response.body());

        } catch (IOException e) {
            throw new IllegalStateException("Failed to call Gemini embeddings API", e);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException("Gemini embeddings request was interrupted", e);
        }
    }

    private String buildEndpoint() {
        return baseUrl
                + "/v1beta/models/"
                + URLEncoder.encode(embeddingModel, StandardCharsets.UTF_8)
                + ":embedContent";
    }

    private String buildRequestBody(String query) throws IOException {
        JsonNode body = objectMapper.createObjectNode()
                .put("model", "models/" + embeddingModel)
                .put("taskType", "RETRIEVAL_QUERY")
                .set("content", objectMapper.createObjectNode()
                        .set("parts", objectMapper.createArrayNode()
                                .add(objectMapper.createObjectNode().put("text", query))));

        return objectMapper.writeValueAsString(body);
    }

    private List<Double> extractEmbedding(String responseBody) throws IOException {
        JsonNode root = objectMapper.readTree(responseBody);
        JsonNode valuesNode = root.path("embedding").path("values");

        if (!valuesNode.isArray() || valuesNode.isEmpty()) {
            throw new IllegalStateException("Gemini response does not contain embedding values");
        }

        List<Double> values = new ArrayList<>(valuesNode.size());
        for (JsonNode node : valuesNode) {
            values.add(node.asDouble());
        }

        return values;
    }
}
package com.untamed.untamedbackend.recommendation.controller;

import com.untamed.untamedbackend.model.ActivityTemplate;
import com.untamed.untamedbackend.model.User;
import com.untamed.untamedbackend.model.UserInsight;
import com.untamed.untamedbackend.recommendation.dto.TemplateEmbeddingPayload;
import com.untamed.untamedbackend.recommendation.dto.UpdateTemplateEmbeddingRequest;
import com.untamed.untamedbackend.recommendation.dto.UpdateUserEmbeddingRequest;
import com.untamed.untamedbackend.recommendation.dto.UserEmbeddingPayload;
import com.untamed.untamedbackend.recommendation.n8n.N8nWebhookService;
import com.untamed.untamedbackend.recommendation.service.AiEmbeddingService;
import com.untamed.untamedbackend.repository.ActivityTemplateRepository;
import com.untamed.untamedbackend.repository.UserInsightRepository;
import com.untamed.untamedbackend.repository.UserRepository;
import com.untamed.untamedbackend.service.UserInsightService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/ai")
@RequiredArgsConstructor
public class AiEmbeddingController {

    private final AiEmbeddingService aiEmbeddingService;
    private final ActivityTemplateRepository activityTemplateRepository;
    private final UserInsightRepository userInsightRepository;
    private final UserRepository userRepository;
    private final UserInsightService userInsightService;
    private final N8nWebhookService n8nWebhookService;

    @GetMapping("/templates/{templateId}/embedding-payload")
    public ResponseEntity<TemplateEmbeddingPayload> getTemplateEmbeddingPayload(@PathVariable String templateId) {
        return ResponseEntity.ok(aiEmbeddingService.getTemplateEmbeddingPayload(templateId));
    }

    @PostMapping("/templates/{templateId}/embedding")
    public ResponseEntity<Void> updateTemplateEmbedding(
            @PathVariable String templateId,
            @Valid @RequestBody UpdateTemplateEmbeddingRequest request
    ) {
        aiEmbeddingService.updateTemplateEmbedding(templateId, request);
        return ResponseEntity.ok().build();
    }

    @PostMapping("/templates/{templateId}/regenerate")
    public ResponseEntity<Map<String, Object>> regenerateTemplateEmbedding(@PathVariable String templateId) {
        ActivityTemplate template = activityTemplateRepository.findById(templateId)
                .orElseThrow(() -> new IllegalArgumentException("Activity template not found"));

        n8nWebhookService.triggerTemplateEmbedding(template.getId());

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("message", "Template embedding regeneration triggered");
        response.put("templateId", template.getId());
        response.put("title", template.getTitle());

        return ResponseEntity.ok(response);
    }

    @PostMapping("/templates/regenerate-all")
    public ResponseEntity<Map<String, Object>> regenerateAllTemplateEmbeddings() {
        List<ActivityTemplate> templates = activityTemplateRepository.findAll();

        int triggered = 0;
        for (ActivityTemplate template : templates) {
            if (template == null || template.getId() == null || template.getId().isBlank()) {
                continue;
            }

            n8nWebhookService.triggerTemplateEmbedding(template.getId());
            triggered++;
        }

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("message", "Bulk template embedding regeneration triggered");
        response.put("triggeredCount", triggered);

        return ResponseEntity.ok(response);
    }

    @GetMapping("/users/{userId}/embedding-payload")
    public ResponseEntity<UserEmbeddingPayload> getUserEmbeddingPayload(@PathVariable String userId) {
        return ResponseEntity.ok(aiEmbeddingService.getUserEmbeddingPayload(userId));
    }

    @PostMapping("/users/{userId}/embedding")
    public ResponseEntity<Void> updateUserEmbedding(
            @PathVariable String userId,
            @Valid @RequestBody UpdateUserEmbeddingRequest request
    ) {
        aiEmbeddingService.updateUserEmbedding(userId, request);
        return ResponseEntity.ok().build();
    }

    @PostMapping("/users/{userId}/regenerate")
    public ResponseEntity<Map<String, Object>> regenerateUserEmbedding(@PathVariable String userId) {
        UserInsight insight = userInsightService.getByUserId(userId);

        n8nWebhookService.triggerUserEmbedding(insight.getUserId());

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("message", "User embedding regeneration triggered");
        response.put("userId", insight.getUserId());

        return ResponseEntity.ok(response);
    }

    @PostMapping("/users/regenerate-all")
    public ResponseEntity<Map<String, Object>> regenerateAllUserEmbeddings() {
        List<UserInsight> insights = userInsightRepository.findAll();

        int triggered = 0;
        for (UserInsight insight : insights) {
            if (insight == null || insight.getUserId() == null || insight.getUserId().isBlank()) {
                continue;
            }

            n8nWebhookService.triggerUserEmbedding(insight.getUserId());
            triggered++;
        }

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("message", "Bulk user embedding regeneration triggered");
        response.put("triggeredCount", triggered);

        return ResponseEntity.ok(response);
    }

    @PostMapping("/users/rebuild-and-regenerate-all")
    public ResponseEntity<Map<String, Object>> rebuildAndRegenerateAllUserEmbeddings() {
        List<User> users = userRepository.findAll();

        int rebuilt = 0;
        int skipped = 0;

        for (User user : users) {
            if (user == null || user.getId() == null || user.getId().isBlank()) {
                skipped++;
                continue;
            }

            if (user.getRole() == null || !"USER".equals(user.getRole().name())) {
                skipped++;
                continue;
            }

            userInsightService.rebuildForUser(user.getId());
            rebuilt++;
        }

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("message", "Bulk user insights rebuilt and embedding regeneration triggered");
        response.put("rebuiltCount", rebuilt);
        response.put("skippedCount", skipped);

        return ResponseEntity.ok(response);
    }
}
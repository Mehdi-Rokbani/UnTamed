package com.untamed.untamedbackend.recommendation.controller;

import com.untamed.untamedbackend.model.ActivityTemplate;
import com.untamed.untamedbackend.recommendation.dto.TemplateEmbeddingPayload;
import com.untamed.untamedbackend.recommendation.dto.UpdateTemplateEmbeddingRequest;
import com.untamed.untamedbackend.recommendation.dto.UpdateUserEmbeddingRequest;
import com.untamed.untamedbackend.recommendation.dto.UserEmbeddingPayload;
import com.untamed.untamedbackend.recommendation.n8n.N8nWebhookService;
import com.untamed.untamedbackend.recommendation.service.AiEmbeddingService;

import com.untamed.untamedbackend.repository.ActivityTemplateRepository;
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
}
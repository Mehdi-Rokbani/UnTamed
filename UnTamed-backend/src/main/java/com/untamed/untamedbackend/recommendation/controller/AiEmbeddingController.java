package com.untamed.untamedbackend.recommendation.controller;

import com.untamed.untamedbackend.recommendation.dto.TemplateEmbeddingPayload;
import com.untamed.untamedbackend.recommendation.dto.UpdateTemplateEmbeddingRequest;
import com.untamed.untamedbackend.recommendation.dto.UpdateUserEmbeddingRequest;
import com.untamed.untamedbackend.recommendation.dto.UserEmbeddingPayload;
import com.untamed.untamedbackend.recommendation.service.AiEmbeddingService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/ai")
@RequiredArgsConstructor
public class AiEmbeddingController {

    private final AiEmbeddingService aiEmbeddingService;

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
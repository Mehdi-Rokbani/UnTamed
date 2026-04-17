package com.untamed.untamedbackend.assistant;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/assistant")
@RequiredArgsConstructor
public class AiActivityAssistantController {

    private final AiActivityAssistantService aiActivityAssistantService;

    @PostMapping("/activity-draft")
    public ResponseEntity<GenerateActivityDraftResponse> generateActivityDraft(
            @Valid @RequestBody GenerateActivityDraftRequest request,
            Authentication authentication
    ) {
        String authEmail = authentication != null ? authentication.getName() : null;

        GenerateActivityDraftResponse response =
                aiActivityAssistantService.generateDraft(request, authEmail);

        return ResponseEntity.ok(response);
    }
}
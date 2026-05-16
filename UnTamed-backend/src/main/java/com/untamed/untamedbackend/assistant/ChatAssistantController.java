package com.untamed.untamedbackend.assistant;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import com.untamed.untamedbackend.security.AuthenticatedUser;

@RestController
@RequestMapping("/api/assistant")
@RequiredArgsConstructor
public class ChatAssistantController {

    private final ChatAssistantService chatAssistantService;

    @PostMapping("/chat")
    public ResponseEntity<ChatAssistantResponse> chat(
            @Valid @RequestBody ChatAssistantRequest request,
            Authentication authentication
    ) {
        return ResponseEntity.ok(chatAssistantService.chat(request, currentUserId(authentication)));
    }

    private String currentUserId(Authentication authentication) {
        if (authentication == null || !authentication.isAuthenticated()) {
            return null;
        }
        if (authentication.getPrincipal() instanceof AuthenticatedUser user) {
            return user.getId();
        }
        return null;
    }
}

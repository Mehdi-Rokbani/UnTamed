package com.untamed.untamedbackend.assistant;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.util.List;

public record ChatAssistantRequest(
        @NotBlank
        @Size(max = 1200)
        String message,

        String activityTemplateId,
        String sessionId,

        @Size(max = 2000)
        String pageContext,

        List<ChatAssistantMessage> history
) {}

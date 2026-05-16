package com.untamed.untamedbackend.assistant;

public record ChatAssistantMessage(
        String role,
        String content
) {}

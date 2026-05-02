package com.untamed.untamedbackend.dto;

public record ActivityTemplateArchiveResponse(
        String templateId,
        ActivityTemplateArchiveAction action,
        String message
) {}
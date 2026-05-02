package com.untamed.untamedbackend.dto;

public record ActivityTemplateDeleteResponse(
        String templateId,
        ActivityTemplateDeleteAction action,
        String message
) {}
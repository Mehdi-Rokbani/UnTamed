package com.untamed.untamedbackend.dto;

public record ActivitySessionDeleteResponse(
        String sessionId,
        ActivitySessionDeleteAction action,
        String message
) {}
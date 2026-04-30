package com.untamed.untamedbackend.dto;

public record ActivitySessionDeleteResponse(
        String sessionId,
        String action,
        String message
) {}
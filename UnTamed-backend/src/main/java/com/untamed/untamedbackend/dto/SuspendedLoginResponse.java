package com.untamed.untamedbackend.dto;

public record SuspendedLoginResponse(
        String error,
        String message,
        String appealToken,
        long expiresInSeconds
) {
}

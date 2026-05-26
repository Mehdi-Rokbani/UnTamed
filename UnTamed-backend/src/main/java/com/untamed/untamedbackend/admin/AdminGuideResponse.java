package com.untamed.untamedbackend.admin;

import java.time.Instant;
import java.util.List;

public record AdminGuideResponse(
        String id,
        String username,
        String email,
        String role,
        boolean verified,
        boolean enabled,
        boolean suspended,
        Instant createdAt,
        long activitiesCount,
        double rating,
        String status,
        String bio,
        String profileImageUrl,
        Integer experienceYears,
        Integer ratingCount,
        List<Certificate> certificates
) {
    public record Certificate(
            String id,
            String title,
            String issuer,
            String credentialId,
            Instant issuedAt,
            Instant expiresAt,
            String verificationUrl,
            String fileUrl,
            String fileType,
            Long fileSizeBytes
    ) {}
}

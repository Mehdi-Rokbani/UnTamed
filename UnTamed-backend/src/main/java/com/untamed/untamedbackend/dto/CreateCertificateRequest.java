package com.untamed.untamedbackend.dto;

import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;
import lombok.*;

import java.net.URI;
import java.time.Instant;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CreateCertificateRequest {
    @NotBlank
    @Size(max = 120)
    private String title;

    @NotBlank
    @Size(max = 120)
    private String issuer;

    @Size(max = 120)
    private String credentialId;
    private Instant issuedAt;
    private Instant expiresAt;

    private String verificationUrl;
    private String fileUrl;

    @Size(max = 100)
    private String fileType;

    @Positive
    private Long fileSizeBytes;

    @AssertTrue(message = "expiresAt must not be before issuedAt")
    public boolean isDateRangeValid() {
        return issuedAt == null || expiresAt == null || !expiresAt.isBefore(issuedAt);
    }

    @AssertTrue(message = "verificationUrl must be a valid http(s) URL")
    public boolean isVerificationUrlValid() {
        return isBlank(verificationUrl) || isHttpUrl(verificationUrl);
    }

    @AssertTrue(message = "fileUrl must be a valid http(s) URL")
    public boolean isFileUrlValid() {
        return isBlank(fileUrl) || isHttpUrl(fileUrl);
    }

    private boolean isBlank(String value) {
        return value == null || value.trim().isEmpty();
    }

    private boolean isHttpUrl(String value) {
        try {
            URI uri = URI.create(value.trim());
            String scheme = uri.getScheme();
            return uri.getHost() != null && ("http".equalsIgnoreCase(scheme) || "https".equalsIgnoreCase(scheme));
        } catch (Exception e) {
            return false;
        }
    }
}

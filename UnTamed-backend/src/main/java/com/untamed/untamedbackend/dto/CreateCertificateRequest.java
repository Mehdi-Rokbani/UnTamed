package com.untamed.untamedbackend.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.*;
import java.time.Instant;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CreateCertificateRequest {
    @NotBlank
    private String title;

    @NotBlank
    private String issuer;

    private String credentialId;
    private Instant issuedAt;
    private Instant expiresAt;

    private String verificationUrl;
    private String fileUrl;

    private String fileType;
    private Long fileSizeBytes;
}

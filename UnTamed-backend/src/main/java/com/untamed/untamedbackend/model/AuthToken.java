package com.untamed.untamedbackend.model;

import lombok.*;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;

@Document(collection = "auth_tokens")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AuthToken {

    public enum Type {
        VERIFY_EMAIL,
        RESET_PASSWORD
    }

    @Id
    private String id;

    private String userId;

    private Type type;

    // store HASH only (sha256)
    private String tokenHash;

    private Instant expiresAt;

    private Instant usedAt;

    @Builder.Default
    private Instant createdAt = Instant.now();
}

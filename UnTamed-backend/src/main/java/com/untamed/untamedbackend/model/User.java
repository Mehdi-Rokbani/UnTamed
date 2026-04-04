package com.untamed.untamedbackend.model;

import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.*;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

@Document(collection = "users")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class User {

    @Id
    private String id;

    @Indexed(unique = true)
    @NotBlank(message = "Email is required")
    @Email(message = "Email format is invalid")
    private String email;

    @Indexed(unique = true)
    @NotBlank(message = "Username is required")
    private String username;

    @Size(max = 20)
    private String phoneNumber;

    @Builder.Default
    private boolean verified = false;

    @Builder.Default
    private boolean suspended = false;


    @NotBlank(message = "Password is required")
    @JsonProperty(access = JsonProperty.Access.WRITE_ONLY) // never sent back in JSON
    private String password;

    @Builder.Default
    private Role role = Role.USER; // USER or GUIDE or ADMIN...

    @Builder.Default
    private boolean enabled = true;

    private String profileImageUrl;
    private String profileImagePublicId; // usually you can omit this from response


    @Size(max = 500)
    private String bio;

    @Builder.Default
    private int confirmedTripsCount = 0;

    @Builder.Default
    private int reviewsWrittenCount = 0;


    // Optional
    private Level level;                 // enum (BEGINNER..)
    private List<String> preferences= new ArrayList<>();   // tags like: "hiking", "history", "budget"

    // Only relevant if role == GUIDE (still optional)
    private GuideProfile guideProfile;

    @Builder.Default
    private Instant createdAt = Instant.now();

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class GuideProfile {

        // Optional: "LinkedIn-style" certificates (metadata + verification/file link)
        @Builder.Default
        private List<Certificate> certificates =new ArrayList<>()  ;

        // Optional: fast read rating (instead of computing from reviews each time)
        private RatingSummary ratingSummary;
        private Integer experienceYears;
        @Builder.Default
        private Boolean verifiedBadge=false;

    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class Certificate {

        private String id;
        private String title;         // e.g. "PADI Open Water"
        private String issuer;        // e.g. "PADI", "Coursera", "AWS"
        private String credentialId;  // optional

        private Instant issuedAt;     // optional
        private Instant expiresAt;    // optional

        // Prefer verificationUrl (like LinkedIn). If none, accept fileUrl (PDF hosted elsewhere)
        private String verificationUrl; // optional
        private String fileUrl;         // optional (PDF link)

        // Optional file metadata (useful if you implement uploads later)
        private String fileType;        // "application/pdf"
        private Long fileSizeBytes;     // optional
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class RatingSummary {
        private Double average; // e.g. 4.7
        private Integer count;  // e.g. 132
    }
}

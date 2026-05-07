package com.untamed.untamedbackend.service;

import com.untamed.untamedbackend.dto.*;
import com.untamed.untamedbackend.model.Role;
import com.untamed.untamedbackend.model.User;
import com.untamed.untamedbackend.repository.UserRepository;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.UUID;

@Service
public class GuideService {

    private final UserRepository repo;

    public GuideService(UserRepository repo) {
        this.repo = repo;
    }

    public GuideProfileResponse getMe(String authEmail) {
        User u = getGuideUser(authEmail);

        User.GuideProfile gp = u.getGuideProfile();
        if (gp == null) {
            gp = User.GuideProfile.builder().experienceYears(null).certificates(new ArrayList<>()).ratingSummary(null).build();
        }


        return GuideProfileResponse.builder()
                .experienceYears(gp.getExperienceYears())
                .certificates(mapCertificates(gp.getCertificates()))
                .ratingSummary(mapRating(gp.getRatingSummary()))
                .verifiedBadge(Boolean.TRUE.equals(gp.getVerifiedBadge()))
                .build();
    }

    public GuideProfileResponse addCertificate(String authEmail, CreateCertificateRequest req) {
        User u = getGuideUser(authEmail);
        ensureGuideProfile(u);

        User.Certificate cert = User.Certificate.builder()
                .id(UUID.randomUUID().toString())
                .title(normalizeRequired(req.getTitle()))
                .issuer(normalizeRequired(req.getIssuer()))
                .credentialId(normalizeOptional(req.getCredentialId()))
                .issuedAt(req.getIssuedAt())
                .expiresAt(req.getExpiresAt())
                .verificationUrl(normalizeOptional(req.getVerificationUrl()))
                .fileUrl(normalizeOptional(req.getFileUrl()))
                .fileType(normalizeOptional(req.getFileType()))
                .fileSizeBytes(req.getFileSizeBytes())
                .build();

        u.getGuideProfile().getCertificates().add(cert);
        repo.save(u);

        return getMe(authEmail);
    }

    public GuideProfileResponse updateCertificate(String authEmail, String certificateId, UpdateCertificateRequest req) {
        User u = getGuideUser(authEmail);
        ensureGuideProfile(u);

        User.Certificate cert = u.getGuideProfile().getCertificates().stream()
                .filter(c -> c.getId() != null && c.getId().equals(certificateId))
                .findFirst()
                .orElseThrow(() -> new IllegalArgumentException("Certificate not found"));

        if (req.getTitle() != null) cert.setTitle(normalizeRequired(req.getTitle()));
        if (req.getIssuer() != null) cert.setIssuer(normalizeRequired(req.getIssuer()));
        if (req.getCredentialId() != null) cert.setCredentialId(normalizeOptional(req.getCredentialId()));
        if (req.getIssuedAt() != null) cert.setIssuedAt(req.getIssuedAt());
        if (req.getExpiresAt() != null) cert.setExpiresAt(req.getExpiresAt());
        if (req.getVerificationUrl() != null) cert.setVerificationUrl(normalizeOptional(req.getVerificationUrl()));
        if (req.getFileUrl() != null) cert.setFileUrl(normalizeOptional(req.getFileUrl()));
        if (req.getFileType() != null) cert.setFileType(normalizeOptional(req.getFileType()));
        if (req.getFileSizeBytes() != null) cert.setFileSizeBytes(req.getFileSizeBytes());

        if (cert.getIssuedAt() != null && cert.getExpiresAt() != null && cert.getExpiresAt().isBefore(cert.getIssuedAt())) {
            throw new IllegalArgumentException("expiresAt must not be before issuedAt");
        }

        repo.save(u);
        return getMe(authEmail);
    }

    public GuideProfileResponse updateMe(String authEmail, UpdateGuideProfileRequest req) {
        User u = getGuideUser(authEmail);
        ensureGuideProfile(u);

        if (req.getExperienceYears() != null) {
            u.getGuideProfile().setExperienceYears(req.getExperienceYears());
        }

        repo.save(u);
        return getMe(authEmail);
    }

    public GuideProfileResponse deleteCertificate(String authEmail, String certificateId) {
        User u = getGuideUser(authEmail);
        ensureGuideProfile(u);

        boolean removed = u.getGuideProfile().getCertificates()
                .removeIf(c -> c.getId() != null && c.getId().equals(certificateId));

        if (!removed) {
            throw new IllegalArgumentException("Certificate not found");
        }

        repo.save(u);
        return getMe(authEmail);
    }

    // ---------- helpers ----------

    private User getGuideUser(String authEmail) {
        User u = repo.findByEmail(authEmail)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));

        if (u.getRole() != Role.GUIDE) {
            throw new IllegalArgumentException("Only GUIDE can access this resource");
        }
        return u;
    }

    private void ensureGuideProfile(User u) {
        if (u.getGuideProfile() == null) {
            u.setGuideProfile(User.GuideProfile.builder()
                    .experienceYears(null)
                    .certificates(new ArrayList<>())
                    .ratingSummary(null)
                    .build());
        } else if (u.getGuideProfile().getCertificates() == null) {
            u.getGuideProfile().setCertificates(new ArrayList<>());
        }
    }

    private List<CertificateResponse> mapCertificates(List<User.Certificate> certs) {
        if (certs == null) return List.of();
        return certs.stream().map(c -> CertificateResponse.builder()
                .id(c.getId())
                .title(c.getTitle())
                .issuer(c.getIssuer())
                .credentialId(c.getCredentialId())
                .issuedAt(c.getIssuedAt())
                .expiresAt(c.getExpiresAt())
                .verificationUrl(c.getVerificationUrl())
                .fileUrl(c.getFileUrl())
                .fileType(c.getFileType())
                .fileSizeBytes(c.getFileSizeBytes())
                .build()
        ).toList();
    }

    private RatingSummaryResponse mapRating(User.RatingSummary rs) {
        if (rs == null) return null;
        return RatingSummaryResponse.builder()
                .average(rs.getAverage())
                .count(rs.getCount())
                .build();
    }

    private String normalizeRequired(String value) {
        return Objects.requireNonNull(value).trim();
    }

    private String normalizeOptional(String value) {
        if (value == null) return null;
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }
}

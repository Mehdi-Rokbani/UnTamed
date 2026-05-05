package com.untamed.untamedbackend.service;

import com.untamed.untamedbackend.dto.RegisterRequest;
import com.untamed.untamedbackend.dto.UpdateProfileRequest;
import com.untamed.untamedbackend.dto.UserGuideProfileResponse;
import com.untamed.untamedbackend.dto.UserResponse;
import com.untamed.untamedbackend.model.Role;
import com.untamed.untamedbackend.model.User;
import com.untamed.untamedbackend.repository.UserRepository;
import com.untamed.untamedbackend.security.PasswordPolicy;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.net.URI;
import java.util.List;

@Service
public class UserService {

    private final UserRepository repo;
    private final BCryptPasswordEncoder encoder;
    private final CloudinaryService cloudinaryService;
    private final EmailVerificationService emailVerificationService;
    private final UserInsightService userInsightService;
    private final LevelingService levelingService;

    public UserService(
            UserRepository repo,
            BCryptPasswordEncoder encoder,
            CloudinaryService cloudinaryService,
            EmailVerificationService emailVerificationService,
            UserInsightService userInsightService, LevelingService levelingService
    ) {
        this.repo = repo;
        this.encoder = encoder;
        this.cloudinaryService = cloudinaryService;
        this.emailVerificationService = emailVerificationService;
        this.userInsightService = userInsightService;
        this.levelingService = levelingService;
    }

    public UserResponse register(RegisterRequest req) {
        String email = normalizeEmail(req.email());
        String username = normalizeUsername(req.username());

        if (email == null || email.isBlank()) throw new IllegalArgumentException("Email is required");
        if (username == null || username.isBlank()) throw new IllegalArgumentException("Username is required");
        if (req.password() == null || req.password().isBlank()) throw new IllegalArgumentException("Password is required");

        PasswordPolicy.validateOrThrow(req.password(), username, email);

        if (repo.existsByEmail(email)) throw new IllegalArgumentException("Email already used");
        if (repo.existsByUsername(username)) throw new IllegalArgumentException("Username already used");

        Role safeRole = (req.role() == Role.GUIDE) ? Role.GUIDE : Role.ADVENTURER;

        User.UserBuilder builder = User.builder()
                .email(email)
                .username(username)
                .password(encoder.encode(req.password()))
                .role(safeRole)
                .enabled(true)
                .profileImageUrl(null)
                .bio(null)
                .preferences(List.of());

        builder.level(isCustomerRole(safeRole) ? req.level() : null);

        if (safeRole == Role.GUIDE) {
            builder.guideProfile(
                    User.GuideProfile.builder()
                            .certificates(List.of())
                            .ratingSummary(null)
                            .build()
            );
        } else {
            builder.guideProfile(null);
        }

        User saved = repo.save(builder.build());
        emailVerificationService.sendVerification(saved);

        return toUserResponse(saved);
    }

    public UserResponse getMe(String authEmail) {
        if (authEmail == null || authEmail.isBlank()) {
            throw new AccessDeniedException("Not authenticated");
        }

        User user = repo.findByEmail(authEmail)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));

        return toUserResponse(user);
    }
    public User getCurrentUser(String email) {
        return repo.findByEmail(email)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));
    }

    public UserResponse recalculateCurrentUserLevel(String email) {
        User user = getCurrentUser(email);
        User updated = levelingService.recalculateUserLevel(user.getId());
        return toUserResponse(updated);
    }

    public UserResponse updateMe(String authEmail, UpdateProfileRequest req) {
        if (authEmail == null || authEmail.isBlank()) {
            throw new AccessDeniedException("Not authenticated");
        }

        User user = repo.findByEmail(authEmail)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));

        if (req.getUsername() != null) {
            String newUsername = normalizeUsername(req.getUsername());
            if (newUsername == null || newUsername.isBlank()) {
                throw new IllegalArgumentException("Username cannot be blank");
            }

            if (!newUsername.equals(user.getUsername()) && repo.existsByUsername(newUsername)) {
                throw new IllegalArgumentException("Username already used");
            }
            user.setUsername(newUsername);
        }

        if (req.getLevel() != null) {
            if (!isCustomerRole(user.getRole())) {
                throw new IllegalArgumentException("Level is only allowed for ADVENTURER");
            }
            user.setLevel(req.getLevel());
        }

        if (req.getBio() != null) {
            String bio = req.getBio().trim();
            user.setBio(bio.isEmpty() ? null : bio);
        }

        if (req.getPhoneNumber() != null) {
            String phoneNumber = req.getPhoneNumber().trim();
            user.setPhoneNumber(phoneNumber.isEmpty() ? null : phoneNumber);
        }

        if (req.getPreferences() != null) {
            user.setPreferences(sanitizePreferences(req.getPreferences()));
        }

        if (req.getProfileImageUrl() != null) {
            String url = req.getProfileImageUrl().trim();
            if (url.isBlank()) {
                user.setProfileImageUrl(null);
            } else {
                validateUrl(url);
                user.setProfileImageUrl(url);
            }
        }

        User saved = repo.save(user);
        userInsightService.onProfileUpdated(saved);

        return toUserResponse(saved);
    }

    private UserResponse toUserResponse(User u) {
        return new UserResponse(
                u.getId(),
                u.getEmail(),
                u.getRole().name(),
                u.getUsername(),
                u.getLevel(),
                u.getXp(),
                u.getLevelNumber(),
                u.getLevelTitle(),
                u.getXpToNextLevel(),
                u.getLevelProgressPercent(),
                u.getProfileImageUrl(),
                u.getPhoneNumber(),
                u.getPreferences(),
                u.getConfirmedTripsCount(),
                u.getReviewsWrittenCount(),
                u.getBio(),
                u.isVerified(),
                u.isEnabled(),
                u.getCreatedAt(),
                toGuideProfileResponse(u)
        );
    }

    private UserGuideProfileResponse toGuideProfileResponse(User u) {
        if (u.getRole() != Role.GUIDE || u.getGuideProfile() == null) {
            return null;
        }

        User.RatingSummary ratingSummary = u.getGuideProfile().getRatingSummary();
        UserGuideProfileResponse.RatingSummaryResponse ratingResponse = ratingSummary == null
                ? null
                : new UserGuideProfileResponse.RatingSummaryResponse(
                ratingSummary.getAverage(),
                ratingSummary.getCount()
        );

        int certificateCount = u.getGuideProfile().getCertificates() == null
                ? 0
                : u.getGuideProfile().getCertificates().size();

        return new UserGuideProfileResponse(
                Boolean.TRUE.equals(u.getGuideProfile().getVerifiedBadge()),
                u.getGuideProfile().getExperienceYears(),
                ratingResponse,
                certificateCount
        );
    }

    private String normalizeEmail(String email) {
        return email == null ? null : email.trim().toLowerCase();
    }

    private String normalizeUsername(String username) {
        return username == null ? null : username.trim();
    }

    private void validateUrl(String url) {
        try {
            URI uri = URI.create(url);
            String scheme = uri.getScheme();
            if (scheme == null || (!scheme.equalsIgnoreCase("http") && !scheme.equalsIgnoreCase("https"))) {
                throw new IllegalArgumentException("Invalid profileImageUrl");
            }
        } catch (Exception e) {
            throw new IllegalArgumentException("Invalid profileImageUrl");
        }
    }

    private List<String> sanitizePreferences(List<String> prefs) {
        if (prefs == null) return List.of();

        return prefs.stream()
                .filter(p -> p != null && !p.trim().isEmpty())
                .map(String::trim)
                .distinct()
                .limit(25)
                .toList();
    }

    public User updateMyProfilePicture(String email, MultipartFile file) {
        User user = repo.findByEmail(email)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));

        cloudinaryService.deleteByPublicId(user.getProfileImagePublicId());

        String folder = "untamed/users/" + user.getId() + "/avatar";
        CloudinaryService.UploadResult up = cloudinaryService.uploadAvatar(file, folder);

        user.setProfileImageUrl(up.url());
        user.setProfileImagePublicId(up.publicId());

        return repo.save(user);
    }

    public User getUserByEmail(String email) {
        return repo.findByEmail(email)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));
    }

    private boolean isCustomerRole(Role role) {
        return role == Role.ADVENTURER || role == Role.USER;
    }
}

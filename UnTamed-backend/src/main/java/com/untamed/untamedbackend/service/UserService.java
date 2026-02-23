package com.untamed.untamedbackend.service;

import com.untamed.untamedbackend.dto.RegisterRequest;
import com.untamed.untamedbackend.dto.UpdateProfileRequest;
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

    public UserService(UserRepository repo, BCryptPasswordEncoder encoder, CloudinaryService cloudinaryService, EmailVerificationService emailVerificationService) {
        this.repo = repo;
        this.encoder = encoder;
        this.cloudinaryService = cloudinaryService;
        this.emailVerificationService = emailVerificationService;

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

        // Allow only USER or GUIDE during self-registration
        Role safeRole = (req.role() == Role.GUIDE) ? Role.GUIDE : Role.USER;

        User.UserBuilder builder = User.builder()
                .email(email)
                .username(username)
                .password(encoder.encode(req.password()))
                .role(safeRole)
                .enabled(true)
                .profileImageUrl(null)
                .bio(null)
                .preferences(List.of());

        // level only for USER
        builder.level(safeRole == Role.USER ? req.level() : null);

        // guideProfile only for GUIDE (if your User model has it)
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

    public UserResponse updateMe(String authEmail, UpdateProfileRequest req) {
        if (authEmail == null || authEmail.isBlank()) {
            throw new AccessDeniedException("Not authenticated");
        }

        User user = repo.findByEmail(authEmail)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));

        // username (optional)
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

        // level is only for USER
        if (req.getLevel() != null) {
            if (user.getRole() != Role.USER) {
                throw new IllegalArgumentException("Level is only allowed for USER");
            }
            user.setLevel(req.getLevel());
        }

        // bio (optional)
        if (req.getBio() != null) {
            String bio = req.getBio().trim();
            user.setBio(bio.isEmpty() ? null : bio);
        }
        // phone number
        if (req.getPhoneNumber() != null) {
            String phoneNumber = req.getPhoneNumber().trim();
            user.setPhoneNumber(phoneNumber.isEmpty() ? null : phoneNumber);
        }

        // preferences (optional; replace if provided)
        if (req.getPreferences() != null) {
            user.setPreferences(sanitizePreferences(req.getPreferences()));
        }

        // profileImageUrl (optional)
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
        return toUserResponse(saved);
    }

    private UserResponse toUserResponse(User u) {
        return new UserResponse(
                u.getId(),
                u.getEmail(),
                u.getRole().name(),
                u.getUsername(),
                u.getLevel(),
                u.getProfileImageUrl(),
                u.getPhoneNumber(),
                u.getPreferences(),
                u.getBio(),
                u.isVerified(),
                u.isEnabled(),
                u.getCreatedAt()
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

        // delete old
        cloudinaryService.deleteByPublicId(user.getProfileImagePublicId());

        // upload new
        String folder = "untamed/users/" + user.getId() + "/avatar";
        CloudinaryService.UploadResult up = cloudinaryService.uploadAvatar(file, folder);

        user.setProfileImageUrl(up.url());
        user.setProfileImagePublicId(up.publicId());

        return repo.save(user);
    }
}

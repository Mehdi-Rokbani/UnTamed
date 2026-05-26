package com.untamed.untamedbackend.service;

import com.untamed.untamedbackend.dto.LoginRequest;
import com.untamed.untamedbackend.dto.LoginResponse;
import com.untamed.untamedbackend.dto.UserGuideProfileResponse;
import com.untamed.untamedbackend.dto.UserResponse;
import com.untamed.untamedbackend.model.Role;
import com.untamed.untamedbackend.model.User;
import com.untamed.untamedbackend.repository.UserRepository;
import com.untamed.untamedbackend.security.JwtService;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;

@Service
public class AuthService {

    private final UserRepository repo;
    private final JwtService jwtService;
    private final BCryptPasswordEncoder encoder;

    public AuthService(UserRepository repo, JwtService jwtService, BCryptPasswordEncoder encoder) {
        this.repo = repo;
        this.jwtService = jwtService;
        this.encoder = encoder;
    }

    public LoginResponse login(LoginRequest req) {
        String email = req.email().trim().toLowerCase();

        User user = repo.findByEmail(email)
                .orElseThrow(() -> new BadCredentialsException("Invalid credentials"));

        if (!encoder.matches(req.password(), user.getPassword())) {
            throw new BadCredentialsException("Invalid credentials");
        }

        if (user.isSuspended()) {
            throw new AccountSuspendedException(
                    jwtService.generateSuspensionAppealToken(user),
                    jwtService.getAppealExpirationSeconds()
            );
        }

        if (!user.isEnabled()) {
            throw new BadCredentialsException("Account disabled");
        }
        if (!user.isVerified()) {
            throw new BadCredentialsException("Email not verified");
        }

        String token = jwtService.generateToken(user);
        return new LoginResponse(token, toUserResponse(user));
    }

    private UserResponse toUserResponse(User user) {
        return new UserResponse(
                user.getId(),
                user.getEmail(),
                user.getRole().name(),
                user.getUsername(),
                user.getLevel(),
                user.getXp(),
                user.getLevelNumber(),
                user.getLevelTitle(),
                user.getXpToNextLevel(),
                user.getLevelProgressPercent(),
                user.getProfileImageUrl(),
                user.getPhoneNumber(),
                user.getPreferences(),
                user.getConfirmedTripsCount(),
                user.getReviewsWrittenCount(),
                user.getBio(),
                user.isVerified(),
                user.isEnabled(),
                user.getCreatedAt(),
                toGuideProfileResponse(user)
        );
    }

    private UserGuideProfileResponse toGuideProfileResponse(User user) {
        if (user.getRole() != Role.GUIDE || user.getGuideProfile() == null) {
            return null;
        }

        User.RatingSummary ratingSummary = user.getGuideProfile().getRatingSummary();
        UserGuideProfileResponse.RatingSummaryResponse ratingResponse = ratingSummary == null
                ? null
                : new UserGuideProfileResponse.RatingSummaryResponse(
                ratingSummary.getAverage(),
                ratingSummary.getCount()
        );

        int certificateCount = user.getGuideProfile().getCertificates() == null
                ? 0
                : user.getGuideProfile().getCertificates().size();

        return new UserGuideProfileResponse(
                Boolean.TRUE.equals(user.getGuideProfile().getVerifiedBadge()),
                user.getGuideProfile().getExperienceYears(),
                ratingResponse,
                certificateCount
        );
    }
}

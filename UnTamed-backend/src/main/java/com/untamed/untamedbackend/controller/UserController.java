package com.untamed.untamedbackend.controller;

import com.untamed.untamedbackend.dto.ProfileActivityFeedResponse;
import com.untamed.untamedbackend.dto.PublicUserProfileResponse;
import com.untamed.untamedbackend.dto.UpdateProfileRequest;
import com.untamed.untamedbackend.dto.UserGuideProfileResponse;
import com.untamed.untamedbackend.dto.UserResponse;
import com.untamed.untamedbackend.model.Role;
import com.untamed.untamedbackend.model.User;
import com.untamed.untamedbackend.model.UserInsight;
import com.untamed.untamedbackend.service.ProfileActivityFeedService;
import com.untamed.untamedbackend.service.PublicUserProfileService;
import com.untamed.untamedbackend.service.UserInsightService;
import com.untamed.untamedbackend.service.UserService;
import jakarta.validation.Valid;
import org.springframework.http.MediaType;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.security.Principal;

@RestController
@RequestMapping("/api/users")
public class UserController {

    private final UserService users;
    private final UserInsightService userInsightService;
    private final ProfileActivityFeedService profileActivityFeedService;
    private final PublicUserProfileService publicUserProfileService;

    public UserController(
            UserService users,
            UserInsightService userInsightService,
            ProfileActivityFeedService profileActivityFeedService,
            PublicUserProfileService publicUserProfileService

            ) {
        this.users = users;
        this.userInsightService = userInsightService;
        this.profileActivityFeedService = profileActivityFeedService;
        this.publicUserProfileService = publicUserProfileService;
    }

    @GetMapping("/me")
    public UserResponse me(Authentication auth) {
        if (auth == null || auth.getName() == null) {
            throw new AccessDeniedException("Not authenticated");
        }
        return users.getMe(auth.getName());
    }

    @GetMapping("/{userId}/public-profile")
    public PublicUserProfileResponse publicProfile(@PathVariable String userId) {
        return publicUserProfileService.getPublicProfile(userId);
    }

    @PatchMapping("/me")
    public UserResponse updateMe(@Valid @RequestBody UpdateProfileRequest req, Authentication auth) {
        if (auth == null || auth.getName() == null) {
            throw new AccessDeniedException("Not authenticated");
        }
        return users.updateMe(auth.getName(), req);
    }

    @PatchMapping(value = "/me/profile-picture", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public UserResponse updateProfilePicture(
            Principal principal,
            @RequestPart("file") MultipartFile file
    ) {
        String email = principal.getName();
        User updated = users.updateMyProfilePicture(email, file);
        return toResponse(updated);
    }

    // 🔥 NEW — GET INSIGHTS
    @GetMapping("/me/insights")
    public UserInsight getMyInsights(Authentication auth) {
        if (auth == null || auth.getName() == null) {
            throw new AccessDeniedException("Not authenticated");
        }

        String email = auth.getName();
        User user = users.getUserByEmail(email); // 👈 we’ll add this method

        return userInsightService.getByUserId(user.getId());
    }

    // 🔥 NEW — REBUILD INSIGHTS
    @PostMapping("/me/insights/rebuild")
    public UserInsight rebuildMyInsights(Authentication auth) {
        if (auth == null || auth.getName() == null) {
            throw new AccessDeniedException("Not authenticated");
        }

        String email = auth.getName();
        User user = users.getUserByEmail(email);

        return userInsightService.rebuildForUser(user.getId());
    }

    @GetMapping("/me/activity-feed")
    public ProfileActivityFeedResponse getMyActivityFeed(
            Authentication auth,
            @RequestParam(defaultValue = "0") int tripsPage,
            @RequestParam(defaultValue = "10") int tripsSize,
            @RequestParam(defaultValue = "0") int reviewsPage,
            @RequestParam(defaultValue = "10") int reviewsSize
    ) {
        if (auth == null || auth.getName() == null) {
            throw new AccessDeniedException("Not authenticated");
        }

        User user = users.getUserByEmail(auth.getName());
        return profileActivityFeedService.getFeed(
                user.getId(),
                tripsPage,
                tripsSize,
                reviewsPage,
                reviewsSize
        );
    }

    private UserResponse toResponse(User u) {
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

    @PostMapping("/me/level/recalculate")
    public UserResponse recalculateMyLevel(Authentication authentication) {
        return users.recalculateCurrentUserLevel(authentication.getName());
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
}

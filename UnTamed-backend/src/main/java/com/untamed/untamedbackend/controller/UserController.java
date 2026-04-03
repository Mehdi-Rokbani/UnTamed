package com.untamed.untamedbackend.controller;

import com.untamed.untamedbackend.dto.UpdateProfileRequest;
import com.untamed.untamedbackend.dto.UserResponse;
import com.untamed.untamedbackend.model.User;
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

    public UserController(UserService users) {
        this.users = users;
    }

    @GetMapping("/me")
    public UserResponse me(Authentication auth) {
        if (auth == null || auth.getName() == null) {
            throw new AccessDeniedException("Not authenticated");
        }
        return users.getMe(auth.getName());
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
        String email = principal.getName(); // must be set by your security
        User updated = users.updateMyProfilePicture(email, file);
        return toResponse(updated);
    }

    private UserResponse toResponse(User u) {
        return new UserResponse(
                u.getId(),
                u.getEmail(),
                u.getRole().name(),
                u.getUsername(),
                u.getLevel(),
                u.getProfileImageUrl(),
                u.getPhoneNumber(),
                u.getPreferences(),
                u.getConfirmedTripsCount(),
                u.getBio(),
                u.isVerified(),
                u.isEnabled(),
                u.getCreatedAt()
        );
    }
}

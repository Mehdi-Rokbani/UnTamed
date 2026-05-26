package com.untamed.untamedbackend.service;

import com.untamed.untamedbackend.model.Role;
import com.untamed.untamedbackend.model.User;
import com.untamed.untamedbackend.repository.UserRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

@Service
public class GuideAccessService {

    private final UserRepository userRepository;

    public GuideAccessService(UserRepository userRepository) {
        this.userRepository = userRepository;
    }

    public User requireActiveGuideByEmail(String authEmail) {
        User user = userRepository.findByEmail(authEmail)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));
        assertActiveGuide(user);
        return user;
    }

    public User requireActiveGuideById(String userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));
        assertActiveGuide(user);
        return user;
    }

    public boolean isPubliclyBookableGuide(String guideId) {
        if (guideId == null || guideId.isBlank()) return false;

        return userRepository.findById(guideId)
                .map(user -> user.getRole() == Role.GUIDE
                        && user.isVerified()
                        && user.isEnabled()
                        && !user.isSuspended())
                .orElse(false);
    }

    public void assertActiveGuide(User user) {
        if (user.getRole() != Role.GUIDE) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Only GUIDE can access this resource.");
        }
        if (!user.isVerified()) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Guide account is pending verification.");
        }
        if (!user.isEnabled() || user.isSuspended()) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Guide account is suspended.");
        }
    }
}

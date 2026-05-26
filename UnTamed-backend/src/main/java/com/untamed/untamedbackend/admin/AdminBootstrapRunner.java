package com.untamed.untamedbackend.admin;

import com.untamed.untamedbackend.model.Role;
import com.untamed.untamedbackend.model.User;
import com.untamed.untamedbackend.repository.UserRepository;
import com.untamed.untamedbackend.security.PasswordPolicy;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Component;

import java.util.List;

@Component
public class AdminBootstrapRunner implements CommandLineRunner {

    private final UserRepository userRepository;
    private final BCryptPasswordEncoder passwordEncoder;
    private final boolean enabled;
    private final String email;
    private final String username;
    private final String password;

    public AdminBootstrapRunner(
            UserRepository userRepository,
            BCryptPasswordEncoder passwordEncoder,
            @Value("${app.admin-bootstrap.enabled:false}") boolean enabled,
            @Value("${app.admin-bootstrap.email:}") String email,
            @Value("${app.admin-bootstrap.username:}") String username,
            @Value("${app.admin-bootstrap.password:}") String password
    ) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.enabled = enabled;
        this.email = email;
        this.username = username;
        this.password = password;
    }

    @Override
    public void run(String... args) {
        if (!enabled) return;

        String normalizedEmail = normalizeEmail(email);
        String normalizedUsername = normalizeUsername(username);

        if (normalizedEmail == null || normalizedEmail.isBlank()) {
            throw new IllegalStateException("app.admin-bootstrap.email is required when admin bootstrap is enabled.");
        }
        if (normalizedUsername == null || normalizedUsername.isBlank()) {
            throw new IllegalStateException("app.admin-bootstrap.username is required when admin bootstrap is enabled.");
        }
        if (password == null || password.isBlank()) {
            throw new IllegalStateException("app.admin-bootstrap.password is required when admin bootstrap is enabled.");
        }

        userRepository.findByEmail(normalizedEmail).ifPresentOrElse(existing -> {
            existing.setRole(Role.ADMIN);
            existing.setVerified(true);
            existing.setEnabled(true);
            existing.setSuspended(false);
            if (existing.getUsername() == null || existing.getUsername().isBlank()) {
                existing.setUsername(normalizedUsername);
            }
            userRepository.save(existing);
        }, () -> {
            if (userRepository.existsByUsername(normalizedUsername)) {
                throw new IllegalStateException("Admin bootstrap username is already used by another account.");
            }

            PasswordPolicy.validateOrThrow(password, normalizedUsername, normalizedEmail);

            User admin = User.builder()
                    .email(normalizedEmail)
                    .username(normalizedUsername)
                    .password(passwordEncoder.encode(password))
                    .role(Role.ADMIN)
                    .verified(true)
                    .enabled(true)
                    .suspended(false)
                    .profileImageUrl(null)
                    .bio(null)
                    .preferences(List.of())
                    .guideProfile(null)
                    .build();

            userRepository.save(admin);
        });
    }

    private String normalizeEmail(String value) {
        return value == null ? null : value.trim().toLowerCase();
    }

    private String normalizeUsername(String value) {
        return value == null ? null : value.trim();
    }
}

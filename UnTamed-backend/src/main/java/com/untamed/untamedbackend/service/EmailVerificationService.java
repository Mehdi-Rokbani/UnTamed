package com.untamed.untamedbackend.service;

import com.untamed.untamedbackend.integrations.email.EmailSender;
import com.untamed.untamedbackend.model.AuthToken;
import com.untamed.untamedbackend.model.User;
import com.untamed.untamedbackend.repository.AuthTokenRepository;
import com.untamed.untamedbackend.repository.UserRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;

@Service
public class EmailVerificationService {

    private final AuthTokenRepository tokenRepo;
    private final UserRepository userRepo;
    private final EmailSender emailSender;

    private final String frontendBaseUrl;
    private final Duration tokenTtl;

    public EmailVerificationService(
            AuthTokenRepository tokenRepo,
            UserRepository userRepo,
            EmailSender emailSender,
            @Value("${app.frontendBaseUrl:http://localhost:5173}") String frontendBaseUrl,
            @Value("${app.emailVerifyTtlMinutes:60}") long ttlMinutes
    ) {
        this.tokenRepo = tokenRepo;
        this.userRepo = userRepo;
        this.emailSender = emailSender;
        this.frontendBaseUrl = frontendBaseUrl;
        this.tokenTtl = Duration.ofMinutes(ttlMinutes);
    }

    public void sendVerification(User user) {
        if (user.isVerified()) return;

        String rawToken = generateToken();
        String hash = sha256(rawToken);

        Instant now = Instant.now();
        AuthToken token = AuthToken.builder()
                .userId(user.getId())
                .type(AuthToken.Type.VERIFY_EMAIL)
                .tokenHash(hash)
                .expiresAt(now.plus(tokenTtl))
                .build();

        tokenRepo.save(token);

        String link = frontendBaseUrl + "/verify-email?token=" + rawToken;

        String subject = "Verify your email";
        String body = "Click to verify your email:\n" + link + "\n\nThis link expires in "
                + tokenTtl.toMinutes() + " minutes.";

        emailSender.send(user.getEmail(), subject, body);
    }

    public void verify(String rawToken) {
        String hash = sha256(rawToken);
        Instant now = Instant.now();

        AuthToken t = tokenRepo.findFirstByTokenHashAndTypeAndUsedAtIsNullAndExpiresAtAfter(
                hash,
                AuthToken.Type.VERIFY_EMAIL,
                now
        ).orElseThrow(() -> new IllegalArgumentException("Invalid or expired token"));

        User user = userRepo.findById(t.getUserId()).orElseThrow(() -> new IllegalArgumentException("User not found"));

        if (!user.isVerified()) {
            user.setVerified(true);
            userRepo.save(user);
        }

        t.setUsedAt(now);
        tokenRepo.save(t);
    }

    private String generateToken() {
        byte[] bytes = new byte[32];
        new SecureRandom().nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    private String sha256(String input) {
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            byte[] out = md.digest(input.getBytes(StandardCharsets.UTF_8));
            return Base64.getUrlEncoder().withoutPadding().encodeToString(out);
        } catch (Exception e) {
            throw new IllegalStateException("SHA-256 not available", e);
        }
    }
}

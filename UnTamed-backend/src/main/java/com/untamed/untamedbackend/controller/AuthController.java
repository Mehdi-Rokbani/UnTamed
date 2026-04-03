package com.untamed.untamedbackend.controller;

import com.untamed.untamedbackend.dto.*;
import com.untamed.untamedbackend.model.User;
import com.untamed.untamedbackend.repository.UserRepository;
import com.untamed.untamedbackend.security.JwtService;
import com.untamed.untamedbackend.service.AuthService;
import com.untamed.untamedbackend.service.EmailVerificationService;
import com.untamed.untamedbackend.service.UserService;
import jakarta.validation.Valid;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseCookie;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.beans.factory.annotation.Value;

import java.util.Map;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private static final String ACCESS_COOKIE = "access_token";
    private static final String REFRESH_COOKIE = "refresh_token";

    private final AuthService authService;
    private final UserService userService;
    private final JwtService jwtService;
    private final UserRepository userRepo;
    private final EmailVerificationService emailVerificationService;

    @Value("${app.cookies.secure:false}")
    private boolean cookieSecure;

    @Value("${app.cookies.same-site:Lax}")
    private String cookieSameSite;


    public AuthController(AuthService authService, UserService userService, JwtService jwtService, UserRepository userRepo , EmailVerificationService emailVerificationService) {
        this.authService = authService;
        this.userService = userService;
        this.jwtService = jwtService;
        this.userRepo = userRepo;
        this.emailVerificationService = emailVerificationService;
    }

    @PostMapping("/login")
    public ResponseEntity<?> login(@Valid @RequestBody LoginRequest req) {
        LoginResponse res = authService.login(req);

        // If LoginResponse is a record: res.token() ; if class: res.getToken()
        String accessToken = getTokenFromLoginResponse(res);
        String email = jwtService.extractEmail(accessToken);

        User user = userRepo.findByEmail(email).orElseThrow();
        String refreshToken = jwtService.generateRefreshToken(user);

        ResponseCookie accessCookie = ResponseCookie.from(ACCESS_COOKIE, accessToken)
                .httpOnly(true)
                .secure(cookieSecure)     // true in prod (HTTPS)
                .sameSite(cookieSameSite)
                .path("/")
                .maxAge(24 * 60 * 60)   // match your access token duration if you want
                .build();

        ResponseCookie refreshCookie = ResponseCookie.from(REFRESH_COOKIE, refreshToken)
                .httpOnly(true)
                .secure(cookieSecure)     // true in prod (HTTPS)
                .sameSite(cookieSameSite)
                .path("/api/auth/refresh")     // limit where it’s sent
                .maxAge(7 * 24 * 60 * 60)
                .build();

        // Return whatever you want here (user info is typical)
        return ResponseEntity.ok()
                .header(HttpHeaders.SET_COOKIE, accessCookie.toString())
                .header(HttpHeaders.SET_COOKIE, refreshCookie.toString())
                .body(toUserResponse(user));

    }
    private UserResponse toUserResponse(User user) {
        return new UserResponse(
                user.getId(),
                user.getEmail(),
                user.getRole().name(),
                user.getUsername(),
                user.getLevel(),
                user.getProfileImageUrl(),
                user.getPhoneNumber(),
                user.getPreferences(),
                user.getConfirmedTripsCount(),
                user.getBio(),
                user.isVerified(),
                user.isEnabled(),
                user.getCreatedAt()
        );
    }


    @PostMapping("/refresh")
    public ResponseEntity<?> refresh(@CookieValue(name = REFRESH_COOKIE, required = false) String refreshToken) {
        if (refreshToken == null || !jwtService.isValid(refreshToken, JwtService.TokenType.REFRESH)) {
            return ResponseEntity.status(401).build();
        }

        String email = jwtService.extractEmail(refreshToken);
        User user = userRepo.findByEmail(email).orElseThrow();
        if (!user.isVerified()) {
            return ResponseEntity.status(403).build();
        }


        String newAccess = jwtService.generateAccessToken(user);

        ResponseCookie accessCookie = ResponseCookie.from(ACCESS_COOKIE, newAccess)
                .httpOnly(true)
                .secure(cookieSecure)     // true in prod (HTTPS)
                .sameSite(cookieSameSite)
                .path("/")
                .maxAge(24 * 60 * 60)
                .build();

        return ResponseEntity.ok()
                .header(HttpHeaders.SET_COOKIE, accessCookie.toString())
                .body(toUserResponse(user));

    }

    @PostMapping("/logout")
    public ResponseEntity<?> logout() {
        ResponseCookie accessCookie = ResponseCookie.from(ACCESS_COOKIE, "")
                .httpOnly(true)
                .secure(cookieSecure)     // true in prod (HTTPS)
                .sameSite(cookieSameSite)
                .path("/")
                .maxAge(0)
                .build();

        ResponseCookie refreshCookie = ResponseCookie.from(REFRESH_COOKIE, "")
                .httpOnly(true)
                .secure(cookieSecure)     // true in prod (HTTPS)
                .sameSite(cookieSameSite)
                .path("/api/auth/refresh")
                .maxAge(0)
                .build();

        return ResponseEntity.ok()
                .header(HttpHeaders.SET_COOKIE, accessCookie.toString())
                .header(HttpHeaders.SET_COOKIE, refreshCookie.toString())
                .build();
    }

    @PostMapping("/register")
    public UserResponse register(@Valid @RequestBody RegisterRequest req) {
        return userService.register(req);
    }
    @PostMapping("/verify-email")
    public ResponseEntity<?> verifyEmail(@Valid @RequestBody VerifyEmailRequest req) {
        emailVerificationService.verify(req.token());
        return ResponseEntity.ok().build();
    }

    @PostMapping("/resend-verification")
    public ResponseEntity<?> resendVerification(@Valid @RequestBody ResendVerificationRequest req) {
        String email = req.email().trim().toLowerCase();
        User user = userRepo.findByEmail(email).orElseThrow();
        emailVerificationService.sendVerification(user);
        return ResponseEntity.ok().build();
    }



    // ---- helpers ----
    private String getTokenFromLoginResponse(LoginResponse res) {
        try {
            // record accessor: token()
            return (String) res.getClass().getMethod("token").invoke(res);
        } catch (Exception ignore) {
            try {
                // classic getter: getToken()
                return (String) res.getClass().getMethod("getToken").invoke(res);
            } catch (Exception e) {
                throw new IllegalStateException("LoginResponse must expose token() or getToken()");
            }
        }
    }


    @GetMapping("/available/username")
    public Map<String, Boolean> usernameAvailable(@RequestParam("u") String u) {
        String username = u == null ? "" : u.trim();
        if (username.length() < 3) return Map.of("available", false);
        boolean exists = userRepo.existsByUsername(username);
        return Map.of("available", !exists);
    }

    @GetMapping("/available/email")
    public Map<String, Boolean> emailAvailable(@RequestParam("e") String e) {
        String email = e == null ? "" : e.trim().toLowerCase();
        if (email.isBlank()) return Map.of("available", false);
        boolean exists = userRepo.existsByEmail(email);
        return Map.of("available", !exists);
    }
}

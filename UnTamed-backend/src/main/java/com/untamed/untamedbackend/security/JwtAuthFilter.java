package com.untamed.untamedbackend.security;

import com.untamed.untamedbackend.model.User;
import com.untamed.untamedbackend.repository.UserRepository;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.List;

@Component
public class JwtAuthFilter extends OncePerRequestFilter {

    private static final String ACCESS_COOKIE = "access_token";

    private final JwtService jwtService;
    private final UserRepository userRepo;

    public JwtAuthFilter(JwtService jwtService, UserRepository userRepo) {
        this.jwtService = jwtService;
        this.userRepo = userRepo;
    }

    @Override
    protected void doFilterInternal(
            HttpServletRequest request,
            HttpServletResponse response,
            FilterChain filterChain
    ) throws ServletException, IOException {

        System.out.println("=== JWT FILTER START ===");
        System.out.println("Request: " + request.getMethod() + " " + request.getRequestURI());

        String token = extractCookie(request, ACCESS_COOKIE);

        if (token != null) {
            System.out.println("Token source: cookie");
        }

        if (token == null) {
            String auth = request.getHeader("Authorization");
            if (auth != null && auth.startsWith("Bearer ")) {
                token = auth.substring(7);
                System.out.println("Token source: Authorization header");
            }
        }

        if (token == null) {
            System.out.println("No token found");
            System.out.println("=== JWT FILTER END ===");
            filterChain.doFilter(request, response);
            return;
        }

        boolean valid = jwtService.isValid(token, JwtService.TokenType.ACCESS);
        System.out.println("Token valid? " + valid);

        if (!valid) {
            System.out.println("Token invalid or wrong type");
            System.out.println("=== JWT FILTER END ===");
            filterChain.doFilter(request, response);
            return;
        }

        String email = jwtService.extractEmail(token);
        String userId = jwtService.extractUserId(token);

        System.out.println("Extracted email from token: " + email);
        System.out.println("Extracted userId from token: " + userId);

        User user = userRepo.findByEmail(email).orElse(null);
        System.out.println("User loaded from DB? " + (user != null));

        if (user != null) {
            System.out.println("DB user id: " + user.getId());
            System.out.println("DB user email: " + user.getEmail());
            System.out.println("DB user role: " + user.getRole());
        }

        if (user == null) {
            System.out.println("No DB user for email from token");
            System.out.println("=== JWT FILTER END ===");
            filterChain.doFilter(request, response);
            return;
        }

        var authorities = List.of(new SimpleGrantedAuthority("ROLE_" + user.getRole().name()));
        AuthenticatedUser principal = new AuthenticatedUser(userId, email);

        System.out.println("Principal id: " + principal.getId());
        System.out.println("Principal email: " + principal.getEmail());
        System.out.println("Authorities: " + authorities);

        UsernamePasswordAuthenticationToken authentication =
                new UsernamePasswordAuthenticationToken(principal, null, authorities);

        System.out.println("Authentication name: " + authentication.getName());
        System.out.println("Authentication principal class: " + authentication.getPrincipal().getClass().getName());
        System.out.println("Authentication principal value: " + authentication.getPrincipal());

        SecurityContextHolder.getContext().setAuthentication(authentication);

        System.out.println("SecurityContext auth set");
        System.out.println("=== JWT FILTER END ===");

        filterChain.doFilter(request, response);
    }

    private String extractCookie(HttpServletRequest request, String name) {
        Cookie[] cookies = request.getCookies();
        if (cookies == null) return null;

        for (Cookie c : cookies) {
            if (name.equals(c.getName())) {
                return c.getValue();
            }
        }
        return null;
    }
}
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

        String token = extractCookie(request, ACCESS_COOKIE);

        // Optional migration fallback: allow Authorization header too
        if (token == null) {
            String auth = request.getHeader("Authorization");
            if (auth != null && auth.startsWith("Bearer ")) token = auth.substring(7);
        }

        if (token == null || !jwtService.isValid(token, JwtService.TokenType.ACCESS)) {
            filterChain.doFilter(request, response);
            return;
        }

        String email = jwtService.extractEmail(token);

        User user = userRepo.findByEmail(email).orElse(null);
        if (user == null) {
            filterChain.doFilter(request, response);
            return;
        }

        var authorities = List.of(new SimpleGrantedAuthority("ROLE_" + user.getRole().name()));
        var authentication = new UsernamePasswordAuthenticationToken(email, null, authorities);

        SecurityContextHolder.getContext().setAuthentication(authentication);
        filterChain.doFilter(request, response);
    }

    private String extractCookie(HttpServletRequest request, String name) {
        Cookie[] cookies = request.getCookies();
        if (cookies == null) return null;
        for (Cookie c : cookies) {
            if (name.equals(c.getName())) return c.getValue();
        }
        return null;
    }
}

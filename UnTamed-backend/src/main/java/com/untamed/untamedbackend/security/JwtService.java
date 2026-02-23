package com.untamed.untamedbackend.security;

import com.untamed.untamedbackend.model.User;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.SignatureAlgorithm;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;
import java.security.Key;
import java.util.Date;

@Service
public class JwtService {

    public enum TokenType { ACCESS, REFRESH }

    private final Key key;
    private final long accessExpirationMs;
    private final long refreshExpirationMs;

    public JwtService(
            @Value("${jwt.secret}") String secret,
            @Value("${jwt.expiration}") long accessExpirationMs,
            @Value("${jwt.refreshExpiration}") long refreshExpirationMs
    ) {
        this.key = Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
        this.accessExpirationMs = accessExpirationMs;
        this.refreshExpirationMs = refreshExpirationMs;
    }

    // Keep compatibility with old code that calls generateToken(user)
    public String generateToken(User user) {
        return generateAccessToken(user);
    }

    public String generateAccessToken(User user) {
        return buildToken(user, TokenType.ACCESS, accessExpirationMs);
    }

    public String generateRefreshToken(User user) {
        return buildToken(user, TokenType.REFRESH, refreshExpirationMs);
    }

    public String extractEmail(String token) {
        return parseClaims(token).getSubject();
    }

    public boolean isValid(String token) {
        return isValid(token, null);
    }

    public boolean isValid(String token, TokenType expectedType) {
        try {
            Claims c = parseClaims(token);
            if (!c.getExpiration().after(new Date())) return false;

            if (expectedType != null) {
                String typ = c.get("typ", String.class);
                return expectedType.name().equals(typ);
            }
            return true;
        } catch (Exception e) {
            return false;
        }
    }

    private String buildToken(User user, TokenType type, long expirationMs) {
        Date now = new Date();
        Date exp = new Date(now.getTime() + expirationMs);

        return Jwts.builder()
                .setSubject(user.getEmail())
                .claim("role", user.getRole().name())
                .claim("typ", type.name())
                .setIssuedAt(now)
                .setExpiration(exp)
                .signWith(key, SignatureAlgorithm.HS256)
                .compact();
    }

    private Claims parseClaims(String token) {
        return Jwts.parser()
                .verifyWith((javax.crypto.SecretKey) key)
                .build()
                .parseSignedClaims(token)
                .getPayload();
    }
}

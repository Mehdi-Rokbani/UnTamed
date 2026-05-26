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

    public enum TokenType { ACCESS, REFRESH, APPEAL }

    private static final String SUSPENSION_APPEAL_PURPOSE = "SUSPENSION_APPEAL";

    private final Key key;
    private final long accessExpirationMs;
    private final long refreshExpirationMs;
    private final long appealExpirationMs;

    public JwtService(
            @Value("${jwt.secret}") String secret,
            @Value("${jwt.expiration}") long accessExpirationMs,
            @Value("${jwt.refreshExpiration}") long refreshExpirationMs,
            @Value("${jwt.appealExpiration:900000}") long appealExpirationMs
    ) {
        this.key = Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
        this.accessExpirationMs = accessExpirationMs;
        this.refreshExpirationMs = refreshExpirationMs;
        this.appealExpirationMs = appealExpirationMs;
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

    public String generateSuspensionAppealToken(User user) {
        return buildToken(user, TokenType.APPEAL, appealExpirationMs);
    }

    public long getAppealExpirationSeconds() {
        return Math.max(1, appealExpirationMs / 1000);
    }

    public String extractEmail(String token) {
        Claims claims = parseClaims(token);
        System.out.println("JWT SUBJECT EMAIL: " + claims.getSubject());
        System.out.println("JWT userId CLAIM: " + claims.get("userId", String.class));
        return claims.getSubject();
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
                if (!expectedType.name().equals(typ)) {
                    return false;
                }
                if (expectedType == TokenType.APPEAL) {
                    return SUSPENSION_APPEAL_PURPOSE.equals(c.get("purpose", String.class));
                }
                return true;
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
                .claim("userId", user.getId())
                .claim("role", user.getRole().name())
                .claim("typ", type.name())
                .claim("purpose", type == TokenType.APPEAL ? SUSPENSION_APPEAL_PURPOSE : "AUTH")
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
    public String extractUserId(String token) {
        Claims claims = parseClaims(token);
        System.out.println("JWT CLAIMS: " + claims);
        return claims.get("userId", String.class);
    }
}

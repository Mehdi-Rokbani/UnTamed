package com.untamed.untamedbackend.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.untamed.untamedbackend.security.JwtAuthFilter;
import com.untamed.untamedbackend.security.SecurityJsonHandlers;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.util.List;

@Configuration
public class SecurityConfig {

    @Bean
    public SecurityFilterChain filterChain(
            HttpSecurity http,
            JwtAuthFilter jwtAuthFilter,
            SecurityJsonHandlers securityJsonHandlers,
            CorsConfigurationSource corsConfigurationSource // ✅ inject bean
    ) throws Exception {

        http
                // ✅ Force Spring Security to use our CORS config
                .cors(cors -> cors.configurationSource(corsConfigurationSource))
                .csrf(csrf -> csrf.disable())
                .sessionManagement(sm -> sm.sessionCreationPolicy(SessionCreationPolicy.STATELESS))

                // JSON responses for 401/403
                .exceptionHandling(eh -> eh
                        .authenticationEntryPoint(securityJsonHandlers)
                        .accessDeniedHandler(securityJsonHandlers)
                )

                .authorizeHttpRequests(auth -> auth

                        // Allow Spring's error endpoint (prevents confusing 403 after exceptions)
                        .requestMatchers("/error").permitAll()

                        // ✅ IMPORTANT: allow browser preflight requests (CORS)
                        .requestMatchers(HttpMethod.OPTIONS, "/**").permitAll()

                        // Public endpoints
                        .requestMatchers("/api/auth/**").permitAll()
                        .requestMatchers("/api/geo/**").permitAll()

                        // Activities READ:
                        .requestMatchers(HttpMethod.GET, "/api/activities/all").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/activities/mine").hasRole("GUIDE")
                        .requestMatchers(HttpMethod.GET, "/api/activities/**").permitAll()

                        // Activities WRITE (GUIDE only)
                        .requestMatchers(HttpMethod.POST, "/api/activities/**").hasRole("GUIDE")
                        .requestMatchers(HttpMethod.PATCH, "/api/activities/**").hasRole("GUIDE")
                        .requestMatchers(HttpMethod.DELETE, "/api/activities/**").hasRole("GUIDE")

                        // User profile endpoints (auth required)
                        .requestMatchers("/api/users/**").authenticated()

                        // Guide endpoints (GUIDE only)
                        .requestMatchers("/api/guides/**").hasRole("GUIDE")

                        // Everything else requires authentication
                        .anyRequest().authenticated()
                )
                .addFilterBefore(jwtAuthFilter, UsernamePasswordAuthenticationFilter.class);

        return http.build();
    }

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration config = new CorsConfiguration();

        // ✅ Better with credentials; avoids some edge cases wi
        // th allowedOrigins
        config.setAllowedOriginPatterns(List.of("http://localhost:5173"));

        config.setAllowedMethods(List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));

        // Safer for future headers (like X-Request-Id)
        config.setAllowedHeaders(List.of("*"));

        // If you ever need to read any custom response header on frontend:
        // config.setExposedHeaders(List.of("X-Request-Id"));

        config.setAllowCredentials(true);

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", config);
        return source;
    }

    @Bean
    public BCryptPasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    @Bean
    public ObjectMapper objectMapper() {
        return new ObjectMapper();
    }
}
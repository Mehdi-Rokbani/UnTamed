package com.untamed.untamedbackend.config;

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
            CorsConfigurationSource corsConfigurationSource
    ) throws Exception {

        http
                .cors(cors -> cors.configurationSource(corsConfigurationSource))
                .csrf(csrf -> csrf.disable())
                .sessionManagement(sm -> sm.sessionCreationPolicy(SessionCreationPolicy.STATELESS))

                .exceptionHandling(eh -> eh
                        .authenticationEntryPoint(securityJsonHandlers)
                        .accessDeniedHandler(securityJsonHandlers)
                )

                .authorizeHttpRequests(auth -> auth
                        .requestMatchers("/error").permitAll()
                        .requestMatchers(HttpMethod.OPTIONS, "/**").permitAll()

                        // Public endpoints
                        .requestMatchers("/api/auth/**").permitAll()
                        .requestMatchers("/api/geo/**").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/templates/public/**").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/sessions/**").permitAll()
                        .requestMatchers(HttpMethod.POST, "/api/search/semantic").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/tags/**").permitAll()

                        // Stripe webhook must be public
                        .requestMatchers(HttpMethod.POST, "/api/payments/stripe/webhook").permitAll()


                        // Stripe payment creation must be authenticated
                        .requestMatchers(HttpMethod.POST, "/api/payments/stripe/create/**").authenticated()

                        // GUIDE-only endpoints
                        .requestMatchers(HttpMethod.GET, "/api/templates/mine").hasRole("GUIDE")
                        .requestMatchers(HttpMethod.POST, "/api/templates/**").hasRole("GUIDE")
                        .requestMatchers(HttpMethod.PATCH, "/api/templates/**").hasRole("GUIDE")
                        .requestMatchers(HttpMethod.DELETE, "/api/templates/**").hasRole("GUIDE")

                        .requestMatchers(HttpMethod.POST, "/api/sessions/**").hasRole("GUIDE")
                        .requestMatchers(HttpMethod.PATCH, "/api/sessions/**").hasRole("GUIDE")
                        .requestMatchers(HttpMethod.DELETE, "/api/sessions/**").hasRole("GUIDE")

                        .requestMatchers("/api/users/**").authenticated()
                        .requestMatchers("/api/guides/**").hasRole("GUIDE")

                        .anyRequest().authenticated()
                )

                .addFilterBefore(jwtAuthFilter, UsernamePasswordAuthenticationFilter.class);

        return http.build();
    }

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration config = new CorsConfiguration();

        config.setAllowedOriginPatterns(List.of("http://localhost:5173"));
        config.setAllowedMethods(List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
        config.setAllowedHeaders(List.of("*"));
        config.setAllowCredentials(true);

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", config);
        return source;
    }

    @Bean
    public BCryptPasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }
}
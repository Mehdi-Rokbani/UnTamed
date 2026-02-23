package com.untamed.untamedbackend.security;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.untamed.untamedbackend.api.ApiError;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.web.AuthenticationEntryPoint;
import org.springframework.security.web.access.AccessDeniedHandler;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.time.Instant;
import java.util.Map;

@Component
public class SecurityJsonHandlers implements AuthenticationEntryPoint, AccessDeniedHandler {

    private final ObjectMapper om;

    public SecurityJsonHandlers(ObjectMapper om) {
        this.om = om;
    }

    @Override
    public void commence(HttpServletRequest request, HttpServletResponse response, AuthenticationException authException)
            throws IOException {

        write(response, request, HttpStatus.UNAUTHORIZED, "Unauthorized", Map.of());
    }

    @Override
    public void handle(HttpServletRequest request, HttpServletResponse response, AccessDeniedException accessDeniedException)
            throws IOException {

        write(response, request, HttpStatus.FORBIDDEN, "Forbidden", Map.of());
    }

    private void write(HttpServletResponse response, HttpServletRequest request, HttpStatus status, String message,
                       Map<String, Object> details) throws IOException {

        ApiError body = new ApiError(
                Instant.now(),
                status.value(),
                status.getReasonPhrase(),
                message,
                request.getRequestURI(),
                request.getHeader("X-Request-Id"),
                details
        );

        response.setStatus(status.value());
        response.setContentType("application/json");
        om.writeValue(response.getOutputStream(), body);
    }
}

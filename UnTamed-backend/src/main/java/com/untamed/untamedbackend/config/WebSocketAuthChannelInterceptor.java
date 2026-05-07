package com.untamed.untamedbackend.config;

import com.untamed.untamedbackend.model.User;
import com.untamed.untamedbackend.repository.UserRepository;
import com.untamed.untamedbackend.security.JwtService;
import lombok.RequiredArgsConstructor;
import org.springframework.messaging.Message;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.ChannelInterceptor;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.stereotype.Component;

import java.util.List;

@Component
@RequiredArgsConstructor
public class WebSocketAuthChannelInterceptor implements ChannelInterceptor {

    private final JwtService jwtService;
    private final UserRepository userRepository;

    @Override
    public Message<?> preSend(Message<?> message, MessageChannel channel) {
        StompHeaderAccessor accessor = StompHeaderAccessor.wrap(message);
        if (StompCommand.CONNECT.equals(accessor.getCommand())) {
            authenticateConnect(accessor);
        }
        return message;
    }

    private void authenticateConnect(StompHeaderAccessor accessor) {
        String authorization = accessor.getFirstNativeHeader("Authorization");
        if (authorization == null || !authorization.startsWith("Bearer ")) {
            throw new AccessDeniedException("Missing WebSocket Authorization header");
        }

        String token = authorization.substring(7);
        if (!jwtService.isValid(token, JwtService.TokenType.ACCESS)) {
            throw new AccessDeniedException("Invalid WebSocket access token");
        }

        String tokenUserId = jwtService.extractUserId(token);
        String email = jwtService.extractEmail(token);
        User user = tokenUserId == null || tokenUserId.isBlank()
                ? userRepository.findByEmail(email)
                .orElseThrow(() -> new AccessDeniedException("WebSocket user not found"))
                : userRepository.findById(tokenUserId)
                .orElseGet(() -> userRepository.findByEmail(email)
                        .orElseThrow(() -> new AccessDeniedException("WebSocket user not found")));

        if (!user.isEnabled() || user.isSuspended()) {
            throw new AccessDeniedException("WebSocket user is disabled");
        }

        var authorities = List.of(new SimpleGrantedAuthority("ROLE_" + user.getRole().name()));
        // REST keeps Authentication#getName as email. For notifications, the WebSocket Principal
        // name is the Mongo user id so convertAndSendToUser(recipientUserId, ...) routes directly.
        var principal = new NotificationWebSocketPrincipal(user.getId(), user.getEmail());
        var authentication = new UsernamePasswordAuthenticationToken(principal, null, authorities);
        accessor.setUser(authentication);
    }
}

package com.untamed.untamedbackend.config;

import com.untamed.untamedbackend.chat.ChatRoomAccessService;
import com.untamed.untamedbackend.chat.ChatRoomAccessService.ChatAccessDecision;
import com.untamed.untamedbackend.model.User;
import com.untamed.untamedbackend.repository.UserRepository;
import com.untamed.untamedbackend.security.JwtService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.messaging.Message;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.support.MessageBuilder;
import org.springframework.messaging.support.MessageHeaderAccessor;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.ChannelInterceptor;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Component;

import java.security.Principal;

@Component
@RequiredArgsConstructor
@Slf4j
public class WebSocketAuthChannelInterceptor implements ChannelInterceptor {

    private static final String CHAT_ROOM_TOPIC_PREFIX = "/topic/chat/rooms/";

    private final JwtService jwtService;
    private final UserRepository userRepository;
    private final ChatRoomAccessService chatRoomAccessService;

    @Override
    public Message<?> preSend(Message<?> message, MessageChannel channel) {
        StompHeaderAccessor accessor = MessageHeaderAccessor.getAccessor(message, StompHeaderAccessor.class);
        boolean rebuiltAccessor = false;
        if (accessor == null) {
            accessor = StompHeaderAccessor.wrap(message);
            rebuiltAccessor = true;
        }

        if (StompCommand.CONNECT.equals(accessor.getCommand())) {
            authenticateConnect(accessor);
        } else if (StompCommand.SUBSCRIBE.equals(accessor.getCommand())) {
            authorizeSubscribe(accessor);
        }

        if (rebuiltAccessor || StompCommand.CONNECT.equals(accessor.getCommand())) {
            return MessageBuilder.createMessage(message.getPayload(), accessor.getMessageHeaders());
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

        String websocketUserId = tokenUserId == null || tokenUserId.isBlank() ? user.getId() : tokenUserId;
        // WebSocket user names must be Mongo user ids. Chat membership and
        // convertAndSendToUser(recipientUserId, ...) both depend on this value.
        var principal = new NotificationWebSocketPrincipal(websocketUserId, user.getEmail());
        log.info(
                "websocket connect authenticated subject={} jwtUserId={} principalName={}",
                email,
                tokenUserId,
                principal.getName()
        );
        accessor.setUser(principal);
        log.info("[WS_CONNECT] principal={}", accessor.getUser() != null ? accessor.getUser().getName() : null);
        log.info(
                "websocket accessor user class={} name={}",
                accessor.getUser() == null ? null : accessor.getUser().getClass().getName(),
                accessor.getUser() == null ? null : accessor.getUser().getName()
        );
    }

    private void authorizeSubscribe(StompHeaderAccessor accessor) {
        String destination = accessor.getDestination();
        if (destination == null || !destination.startsWith(CHAT_ROOM_TOPIC_PREFIX)) {
            return;
        }

        log.info("chat subscribe destination: {}", destination);

        String roomId = extractChatRoomId(destination);
        if (roomId.isBlank()) {
            log.warn("chat subscribe denied destination={} reason=invalid room id parsedRoomId={}", destination, roomId);
            throw new AccessDeniedException("Invalid chat room subscription");
        }

        String currentUserId = currentUserId(accessor.getUser());
        log.info("chat subscribe roomId: {}", roomId);
        log.info("chat subscribe userId: {}", currentUserId);

        if (currentUserId == null || currentUserId.isBlank()) {
            log.warn("chat subscribe denied roomId={} reason=missing authenticated user", roomId);
            throw new AccessDeniedException("Authentication required for chat room subscription");
        }

        ChatAccessDecision decision;
        try {
            decision = chatRoomAccessService.inspectRoomAccess(roomId, currentUserId);
        } catch (Exception e) {
            log.warn(
                    "chat subscribe access check exception roomId={} userId={} exceptionClass={} message={}",
                    roomId,
                    currentUserId,
                    e.getClass().getName(),
                    e.getMessage()
            );
            throw new AccessDeniedException("Could not verify chat room subscription", e);
        }

        log.info(
                "chat subscribe allowed: {} roomId={} sessionId={} userId={} guideId={} guideMatch={} completedBookingMatch={} reason={}",
                decision.allowed(),
                decision.roomId(),
                decision.sessionId(),
                decision.currentUserId(),
                decision.guideId(),
                decision.guideMatch(),
                decision.completedBookingMatch(),
                decision.reason()
        );
        if (!decision.allowed()) {
            throw new AccessDeniedException("You cannot subscribe to this chat room: " + decision.reason());
        }
    }

    private String extractChatRoomId(String destination) {
        String roomId = destination.substring(CHAT_ROOM_TOPIC_PREFIX.length()).trim();
        int queryIndex = roomId.indexOf('?');
        if (queryIndex >= 0) {
            roomId = roomId.substring(0, queryIndex);
        }
        if (roomId.endsWith("/typing")) {
            roomId = roomId.substring(0, roomId.length() - "/typing".length());
        }
        if (roomId.contains("/")) {
            return "";
        }
        return roomId.trim();
    }

    private String currentUserId(Principal principal) {
        if (principal == null) {
            return null;
        }

        if (principal instanceof NotificationWebSocketPrincipal wsPrincipal) {
            return wsPrincipal.userId();
        }

        if (principal instanceof org.springframework.security.core.Authentication authentication) {
            Object authPrincipal = authentication.getPrincipal();

            if (authPrincipal instanceof com.untamed.untamedbackend.security.AuthenticatedUser authenticatedUser) {
                return authenticatedUser.getId();
            }

            if (authPrincipal instanceof NotificationWebSocketPrincipal wsPrincipal) {
                return wsPrincipal.userId();
            }
        }

        return principal.getName();
    }
}

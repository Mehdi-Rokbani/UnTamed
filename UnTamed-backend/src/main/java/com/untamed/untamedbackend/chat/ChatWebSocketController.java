package com.untamed.untamedbackend.chat;

import com.untamed.untamedbackend.config.NotificationWebSocketPrincipal;
import com.untamed.untamedbackend.model.User;
import com.untamed.untamedbackend.repository.UserRepository;
import com.untamed.untamedbackend.security.AuthenticatedUser;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.messaging.handler.annotation.DestinationVariable;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Controller;
import org.springframework.web.server.ResponseStatusException;

import java.security.Principal;
import java.time.Instant;

@Controller
@RequiredArgsConstructor
@Slf4j
public class ChatWebSocketController {

    private final ChatService chatService;
    private final SimpMessagingTemplate messagingTemplate;
    private final UserRepository userRepository;

    @MessageMapping("/chat/rooms/{roomId}/send")
    public void sendMessage(
            @DestinationVariable String roomId,
            @Payload @Valid SendChatMessageRequest request,
            Principal principal
    ) {
        String currentUserId = currentUserId(principal);
        if (currentUserId == null || currentUserId.isBlank()) {
            throw new AccessDeniedException("Authentication required.");
        }

        String message = request == null ? null : request.message();
        log.info("chat ws send received roomId={} userId={} message={}", roomId, currentUserId, message);

        try {
            ChatMessageResponse response = chatService.sendMessage(roomId, currentUserId, request);
            String destination = "/topic/chat/rooms/" + roomId;
            log.info("chat ws broadcast destination={} messageId={}", destination, response.id());
            messagingTemplate.convertAndSend(destination, response);
        } catch (RuntimeException e) {
            log.warn(
                    "chat ws send failed roomId={} userId={} exceptionClass={} message={}",
                    roomId,
                    currentUserId,
                    e.getClass().getName(),
                    e.getMessage()
            );
            throw e;
        }
    }

    @MessageMapping("/chat/rooms/{roomId}/typing")
    public void sendTyping(
            @DestinationVariable String roomId,
            @Payload ChatTypingEvent request,
            Principal principal
    ) {
        String currentUserId = currentUserId(principal);
        if (currentUserId == null || currentUserId.isBlank()) {
            throw new AccessDeniedException("Authentication required.");
        }
        if (!chatService.canAccessRoom(roomId, currentUserId)) {
            throw new AccessDeniedException("You cannot access this chat room.");
        }

        User user = userRepository.findById(currentUserId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found."));
        ChatTypingEvent event = new ChatTypingEvent(
                roomId,
                currentUserId,
                user.getUsername(),
                request != null && request.typing(),
                Instant.now()
        );

        String destination = "/topic/chat/rooms/" + roomId + "/typing";
        log.debug("chat typing broadcast destination={} userId={} typing={}", destination, currentUserId, event.typing());
        messagingTemplate.convertAndSend(destination, event);
    }

    private String currentUserId(Principal principal) {
        if (principal == null) {
            return null;
        }

        if (principal instanceof NotificationWebSocketPrincipal wsPrincipal) {
            return wsPrincipal.userId();
        }

        if (principal instanceof Authentication authentication) {
            Object authPrincipal = authentication.getPrincipal();

            if (authPrincipal instanceof AuthenticatedUser authenticatedUser) {
                return authenticatedUser.getId();
            }

            if (authPrincipal instanceof NotificationWebSocketPrincipal wsPrincipal) {
                return wsPrincipal.userId();
            }
        }

        return principal.getName();
    }
}

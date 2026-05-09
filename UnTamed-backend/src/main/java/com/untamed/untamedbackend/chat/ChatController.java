package com.untamed.untamedbackend.chat;

import com.untamed.untamedbackend.dto.PaginatedResponse;
import com.untamed.untamedbackend.security.AuthenticatedUser;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

@RestController
@RequestMapping("/api/chat")
@RequiredArgsConstructor
@Slf4j
public class ChatController {

    private final ChatService chatService;
    private final SimpMessagingTemplate messagingTemplate;

    @GetMapping("/rooms")
    public PaginatedResponse<ChatRoomResponse> listMyRooms(
            Authentication authentication,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size
    ) {
        return chatService.listMyRooms(currentUserId(authentication), page, size);
    }

    @GetMapping("/sessions/{sessionId}/room")
    public ChatRoomResponse getOrCreateSessionRoom(
            @PathVariable String sessionId,
            Authentication authentication
    ) {
        return chatService.getOrCreateSessionRoom(sessionId, currentUserId(authentication));
    }

    @GetMapping("/rooms/{roomId}/messages")
    public PaginatedResponse<ChatMessageResponse> listMessages(
            @PathVariable String roomId,
            Authentication authentication,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "50") int size
    ) {
        return chatService.listMessages(roomId, currentUserId(authentication), page, size);
    }

    @GetMapping("/rooms/{roomId}/members")
    public List<ChatRoomMemberDto> listMembers(
            @PathVariable String roomId,
            Authentication authentication
    ) {
        return chatService.listMembers(roomId, currentUserId(authentication));
    }

    @PostMapping("/rooms/{roomId}/leave")
    public ChatRoomResponse leaveRoom(
            @PathVariable String roomId,
            Authentication authentication
    ) {
        return chatService.leaveRoom(roomId, currentUserId(authentication));
    }

    @DeleteMapping("/rooms/{roomId}/members/{userId}")
    public ChatRoomResponse removeMember(
            @PathVariable String roomId,
            @PathVariable String userId,
            Authentication authentication
    ) {
        return chatService.removeMember(roomId, userId, currentUserId(authentication));
    }

    @PostMapping("/rooms/{roomId}/read")
    public ChatRoomResponse markRoomRead(
            @PathVariable String roomId,
            Authentication authentication
    ) {
        return chatService.markRoomRead(roomId, currentUserId(authentication));
    }

    @PostMapping("/rooms/{roomId}/messages")
    public ChatMessageResponse sendMessage(
            @PathVariable String roomId,
            Authentication authentication,
            @Valid @RequestBody SendChatMessageRequest request
    ) {
        String currentUserId = currentUserId(authentication);
        log.debug("chat REST send roomId={} userId={}", roomId, currentUserId);
        ChatMessageResponse response = chatService.sendMessage(roomId, currentUserId, request);
        String destination = "/topic/chat/rooms/" + roomId;
        log.debug("chat REST broadcast destination={} messageId={}", destination, response.id());
        messagingTemplate.convertAndSend(destination, response);
        return response;
    }

    private String currentUserId(Authentication authentication) {
        if (authentication == null || !authentication.isAuthenticated()) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Authentication required");
        }

        if (authentication.getPrincipal() instanceof AuthenticatedUser user) {
            return user.getId();
        }

        throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Authenticated user ID not available.");
    }
}

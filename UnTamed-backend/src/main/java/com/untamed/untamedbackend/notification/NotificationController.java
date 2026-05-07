package com.untamed.untamedbackend.notification;

import com.untamed.untamedbackend.dto.PaginatedResponse;
import com.untamed.untamedbackend.security.AuthenticatedUser;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import java.util.Map;

@RestController
@RequestMapping("/api/notifications")
@RequiredArgsConstructor
public class NotificationController {

    private final NotificationService notificationService;

    @GetMapping
    public PaginatedResponse<NotificationResponse> listMine(
            Authentication authentication,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size
    ) {
        return notificationService.listMine(currentUserId(authentication), page, size);
    }

    @GetMapping("/unread-count")
    public Map<String, Long> unreadCount(Authentication authentication) {
        return Map.of("count", notificationService.unreadCount(currentUserId(authentication)));
    }

    @PatchMapping("/{id}/read")
    public NotificationResponse markRead(
            @PathVariable String id,
            Authentication authentication
    ) {
        return notificationService.markRead(id, currentUserId(authentication));
    }

    @PatchMapping("/read-all")
    public ResponseEntity<Void> markAllRead(Authentication authentication) {
        notificationService.markAllRead(currentUserId(authentication));
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteMine(
            @PathVariable String id,
            Authentication authentication
    ) {
        notificationService.deleteMine(id, currentUserId(authentication));
        return ResponseEntity.noContent().build();
    }

    // Dev/test helper for manually verifying REST persistence and WebSocket delivery.
    @PostMapping("/test")
    public NotificationResponse createTestNotification(
            Authentication authentication,
            @RequestParam(defaultValue = "Test notification") String title,
            @RequestParam(defaultValue = "This is a test notification.") String message
    ) {
        return notificationService.createAndSend(
                currentUserId(authentication),
                NotificationType.SYSTEM,
                title,
                message,
                NotificationSeverity.INFO,
                null,
                "SYSTEM",
                null
        );
    }

    private String currentUserId(Authentication authentication) {
        if (authentication == null || !authentication.isAuthenticated()) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Authentication required");
        }

        if (authentication.getPrincipal() instanceof AuthenticatedUser user) {
            return user.getId();
        }

        throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Unsupported authentication principal");
    }
}

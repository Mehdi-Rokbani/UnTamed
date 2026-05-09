package com.untamed.untamedbackend.notification;

import com.untamed.untamedbackend.dto.PaginatedResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.Objects;

@Service
@RequiredArgsConstructor
public class NotificationService {

    private static final int MAX_PAGE_SIZE = 50;

    private final NotificationRepository notificationRepository;
    private final NotificationWebSocketService webSocketService;

    public NotificationResponse createAndSend(
            String recipientUserId,
            NotificationType type,
            String title,
            String message,
            NotificationSeverity severity,
            String actionUrl,
            String relatedEntityType,
            String relatedEntityId
    ) {
        if (isBlank(recipientUserId)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Recipient user id is required");
        }
        if (isBlank(title)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Notification title is required");
        }
        if (isBlank(message)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Notification message is required");
        }

        Notification notification = Notification.builder()
                .recipientUserId(recipientUserId)
                .type(type != null ? type : NotificationType.SYSTEM)
                .title(title)
                .message(message)
                .severity(severity != null ? severity : NotificationSeverity.INFO)
                .read(false)
                .actionUrl(blankToNull(actionUrl))
                .relatedEntityType(blankToNull(relatedEntityType))
                .relatedEntityId(blankToNull(relatedEntityId))
                .createdAt(Instant.now())
                .build();

        NotificationResponse response = toResponse(notificationRepository.save(notification));
        try {
            webSocketService.sendToUser(recipientUserId, response);
        } catch (RuntimeException e) {
            System.out.println("Failed to send notification over WebSocket for user "
                    + recipientUserId + ": " + e.getMessage());
        }
        return response;
    }

    public NotificationResponse createAndSendIfAbsent(
            String recipientUserId,
            NotificationType type,
            String title,
            String message,
            NotificationSeverity severity,
            String actionUrl,
            String relatedEntityType,
            String relatedEntityId
    ) {
        if (!isBlank(recipientUserId)
                && type != null
                && !isBlank(relatedEntityType)
                && !isBlank(relatedEntityId)
                && notificationRepository.existsByRecipientUserIdAndTypeAndRelatedEntityTypeAndRelatedEntityId(
                recipientUserId,
                type,
                relatedEntityType.trim(),
                relatedEntityId.trim()
        )) {
            return null;
        }

        return createAndSend(
                recipientUserId,
                type,
                title,
                message,
                severity,
                actionUrl,
                relatedEntityType,
                relatedEntityId
        );
    }

    public List<NotificationResponse> notifyUsers(
            Collection<String> userIds,
            NotificationType type,
            String title,
            String message,
            NotificationSeverity severity,
            String actionUrl,
            String relatedEntityType,
            String relatedEntityId
    ) {
        if (userIds == null || userIds.isEmpty()) {
            return List.of();
        }

        return userIds.stream()
                .filter(Objects::nonNull)
                .map(String::trim)
                .filter(id -> !id.isEmpty())
                .distinct()
                .map(userId -> createAndSend(
                        userId,
                        type,
                        title,
                        message,
                        severity,
                        actionUrl,
                        relatedEntityType,
                        relatedEntityId
                ))
                .toList();
    }

    public PaginatedResponse<NotificationResponse> listMine(String currentUserId, int page, int size) {
        PageRequest pageable = PageRequest.of(
                Math.max(0, page),
                Math.max(1, Math.min(size, MAX_PAGE_SIZE))
        );
        Page<Notification> notifications =
                notificationRepository.findByRecipientUserIdAndTypeNotOrderByCreatedAtDesc(
                        currentUserId,
                        NotificationType.CHAT_MESSAGE,
                        pageable
                );
        List<NotificationResponse> content = notifications.getContent().stream()
                .map(this::toResponse)
                .toList();

        return PaginatedResponse.from(notifications, content);
    }

    public long unreadCount(String currentUserId) {
        return notificationRepository.countByRecipientUserIdAndReadFalseAndTypeNot(
                currentUserId,
                NotificationType.CHAT_MESSAGE
        );
    }

    public NotificationResponse markRead(String notificationId, String currentUserId) {
        Notification notification = findMineOrThrow(notificationId, currentUserId);
        if (!notification.isRead()) {
            notification.setRead(true);
            notification.setReadAt(Instant.now());
            notification = notificationRepository.save(notification);
        }
        return toResponse(notification);
    }

    public void markAllRead(String currentUserId) {
        List<Notification> unread = notificationRepository.findByRecipientUserIdAndReadFalseAndTypeNot(
                currentUserId,
                NotificationType.CHAT_MESSAGE
        );
        if (unread.isEmpty()) {
            return;
        }

        Instant now = Instant.now();
        unread.forEach(notification -> {
            notification.setRead(true);
            notification.setReadAt(now);
        });
        notificationRepository.saveAll(unread);
    }

    public void deleteMine(String notificationId, String currentUserId) {
        Notification notification = findMineOrThrow(notificationId, currentUserId);
        notificationRepository.delete(notification);
    }

    private Notification findMineOrThrow(String notificationId, String currentUserId) {
        return notificationRepository.findByIdAndRecipientUserId(notificationId, currentUserId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Notification not found"));
    }

    private NotificationResponse toResponse(Notification notification) {
        return new NotificationResponse(
                notification.getId(),
                notification.getType(),
                notification.getTitle(),
                notification.getMessage(),
                notification.getSeverity(),
                notification.isRead(),
                notification.getReadAt(),
                notification.getActionUrl(),
                notification.getRelatedEntityType(),
                notification.getRelatedEntityId(),
                notification.getCreatedAt()
        );
    }

    private static boolean isBlank(String value) {
        return value == null || value.trim().isEmpty();
    }

    private static String blankToNull(String value) {
        return isBlank(value) ? null : value.trim();
    }
}

package com.untamed.untamedbackend.notification;

import lombok.RequiredArgsConstructor;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class NotificationWebSocketService {

    private final SimpMessagingTemplate messagingTemplate;

    public void sendToUser(String recipientUserId, NotificationResponse notification) {
        messagingTemplate.convertAndSendToUser(
                recipientUserId,
                "/queue/notifications",
                notification
        );
    }
}

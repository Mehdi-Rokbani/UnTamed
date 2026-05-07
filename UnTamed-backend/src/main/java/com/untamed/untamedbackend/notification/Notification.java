package com.untamed.untamedbackend.notification;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.index.CompoundIndexes;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;

@Document(collection = "notifications")
@CompoundIndexes({
        @CompoundIndex(name = "idx_notifications_recipient_created", def = "{'recipientUserId': 1, 'createdAt': -1}"),
        @CompoundIndex(name = "idx_notifications_recipient_read", def = "{'recipientUserId': 1, 'read': 1}"),
        @CompoundIndex(name = "idx_notifications_related_entity", def = "{'relatedEntityType': 1, 'relatedEntityId': 1}")
})
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Notification {

    @Id
    private String id;

    @NotBlank
    private String recipientUserId;

    @NotNull
    private NotificationType type;

    @NotBlank
    @Size(max = 160)
    private String title;

    @NotBlank
    @Size(max = 1000)
    private String message;

    @NotNull
    private NotificationSeverity severity;

    @Builder.Default
    private boolean read = false;

    private Instant readAt;
    private String actionUrl;
    private String relatedEntityType;
    private String relatedEntityId;
    private Instant createdAt;
}

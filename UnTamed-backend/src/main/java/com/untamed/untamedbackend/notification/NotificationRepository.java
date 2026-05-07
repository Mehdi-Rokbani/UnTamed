package com.untamed.untamedbackend.notification;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;
import java.util.Optional;

public interface NotificationRepository extends MongoRepository<Notification, String> {
    Page<Notification> findByRecipientUserIdOrderByCreatedAtDesc(String recipientUserId, Pageable pageable);

    long countByRecipientUserIdAndReadFalse(String recipientUserId);

    Optional<Notification> findByIdAndRecipientUserId(String id, String recipientUserId);

    List<Notification> findByRecipientUserIdAndReadFalse(String recipientUserId);

    boolean existsByRecipientUserIdAndTypeAndRelatedEntityTypeAndRelatedEntityId(
            String recipientUserId,
            NotificationType type,
            String relatedEntityType,
            String relatedEntityId
    );
}

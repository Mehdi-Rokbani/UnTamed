package com.untamed.untamedbackend.notification;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;
import java.util.Optional;

public interface NotificationRepository extends MongoRepository<Notification, String> {
    Page<Notification> findByRecipientUserIdOrderByCreatedAtDesc(String recipientUserId, Pageable pageable);

    Page<Notification> findByRecipientUserIdAndTypeNotOrderByCreatedAtDesc(
            String recipientUserId,
            NotificationType type,
            Pageable pageable
    );

    long countByRecipientUserIdAndReadFalse(String recipientUserId);

    long countByRecipientUserIdAndReadFalseAndTypeNot(String recipientUserId, NotificationType type);

    Optional<Notification> findByIdAndRecipientUserId(String id, String recipientUserId);

    List<Notification> findByRecipientUserIdAndReadFalse(String recipientUserId);

    List<Notification> findByRecipientUserIdAndReadFalseAndTypeNot(String recipientUserId, NotificationType type);

    boolean existsByRecipientUserIdAndTypeAndRelatedEntityTypeAndRelatedEntityId(
            String recipientUserId,
            NotificationType type,
            String relatedEntityType,
            String relatedEntityId
    );
}

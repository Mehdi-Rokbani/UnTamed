package com.untamed.untamedbackend.chat;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.time.Instant;
import java.util.Optional;

public interface ChatMessageRepository extends MongoRepository<ChatMessage, String> {
    Page<ChatMessage> findByRoomIdOrderByCreatedAtDesc(String roomId, Pageable pageable);

    Optional<ChatMessage> findFirstByRoomIdOrderByCreatedAtDesc(String roomId);

    long countByRoomIdAndSenderIdNotAndType(String roomId, String senderId, ChatMessageType type);

    long countByRoomIdAndCreatedAtAfterAndSenderIdNotAndType(
            String roomId,
            Instant createdAt,
            String senderId,
            ChatMessageType type
    );
}

package com.untamed.untamedbackend.chat;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.index.CompoundIndexes;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;

@Document(collection = "chat_messages")
@CompoundIndexes({
        @CompoundIndex(name = "idx_chat_messages_room_created", def = "{'roomId': 1, 'createdAt': -1}"),
        @CompoundIndex(name = "idx_chat_messages_session_created", def = "{'sessionId': 1, 'createdAt': -1}"),
        @CompoundIndex(name = "idx_chat_messages_sender_created", def = "{'senderId': 1, 'createdAt': -1}")
})
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ChatMessage {

    @Id
    private String id;

    private String roomId;
    private String sessionId;
    private String senderId;
    private String senderRole;
    private ChatMessageType type;
    private String message;
    private Instant createdAt;
    private Instant editedAt;
    private Instant deletedAt;
}

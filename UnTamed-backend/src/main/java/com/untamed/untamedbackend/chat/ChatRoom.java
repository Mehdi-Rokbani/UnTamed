package com.untamed.untamedbackend.chat;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.index.CompoundIndexes;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

@Document(collection = "chat_rooms")
@CompoundIndexes({
        @CompoundIndex(name = "idx_chat_rooms_guide_updated", def = "{'guideId': 1, 'updatedAt': -1}"),
        @CompoundIndex(name = "idx_chat_rooms_participant_updated", def = "{'participantUserIds': 1, 'updatedAt': -1}")
})
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ChatRoom {

    @Id
    private String id;

    @Indexed(unique = true)
    private String sessionId;

    private String templateId;
    private String guideId;

    @Builder.Default
    private List<String> participantUserIds = new ArrayList<>();

    private String lastMessagePreview;
    private Instant lastMessageAt;
    private Instant createdAt;
    private Instant updatedAt;
}

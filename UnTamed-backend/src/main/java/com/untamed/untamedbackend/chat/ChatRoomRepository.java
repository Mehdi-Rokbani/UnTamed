package com.untamed.untamedbackend.chat;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface ChatRoomRepository extends MongoRepository<ChatRoom, String> {
    Optional<ChatRoom> findBySessionId(String sessionId);

    Page<ChatRoom> findByGuideId(String guideId, Pageable pageable);

    Page<ChatRoom> findByParticipantUserIdsContaining(String participantUserId, Pageable pageable);

    List<ChatRoom> findByGuideId(String guideId);

    List<ChatRoom> findByParticipantUserIdsContaining(String participantUserId);

    List<ChatRoom> findBySessionIdIn(Collection<String> sessionIds);
}

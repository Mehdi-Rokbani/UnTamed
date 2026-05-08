package com.untamed.untamedbackend.chat;

import com.untamed.untamedbackend.booking.BookingRepository;
import com.untamed.untamedbackend.booking.BookingStatus;
import com.untamed.untamedbackend.model.ActivitySession;
import com.untamed.untamedbackend.repository.ActivitySessionRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class ChatRoomAccessService {

    private final ChatRoomRepository chatRoomRepository;
    private final ActivitySessionRepository activitySessionRepository;
    private final BookingRepository bookingRepository;

    public record ChatAccessDecision(
            boolean allowed,
            String reason,
            String roomId,
            String sessionId,
            String guideId,
            String currentUserId,
            boolean guideMatch,
            boolean completedBookingMatch
    ) {
    }

    public boolean canAccessRoom(String roomId, String currentUserId) {
        return inspectRoomAccess(roomId, currentUserId).allowed();
    }

    public ChatAccessDecision inspectRoomAccess(String roomId, String currentUserId) {
        if (roomId == null || roomId.isBlank()) {
            return new ChatAccessDecision(false, "missing room id", roomId, null, null, currentUserId, false, false);
        }
        if (currentUserId == null || currentUserId.isBlank()) {
            return new ChatAccessDecision(false, "missing user id", roomId, null, null, currentUserId, false, false);
        }

        ChatRoom room = chatRoomRepository.findById(roomId).orElse(null);
        if (room == null) {
            return new ChatAccessDecision(false, "room not found", roomId, null, null, currentUserId, false, false);
        }
        if (room.getSessionId() == null || room.getSessionId().isBlank()) {
            return new ChatAccessDecision(false, "room has no session id", roomId, null, room.getGuideId(), currentUserId, false, false);
        }

        ActivitySession session = activitySessionRepository.findById(room.getSessionId()).orElse(null);
        if (session == null) {
            return new ChatAccessDecision(false, "session not found", roomId, room.getSessionId(), room.getGuideId(), currentUserId, false, false);
        }

        boolean guideMatch = currentUserId.equals(session.getGuideId());
        boolean completedBookingMatch = bookingRepository.existsBySessionIdAndUserIdAndStatus(
                session.getId(),
                currentUserId,
                BookingStatus.COMPLETED
        );
        boolean allowed = guideMatch || completedBookingMatch;
        String reason = allowed
                ? guideMatch ? "session guide" : "completed booking"
                : "no completed booking or guide ownership";

        return new ChatAccessDecision(
                allowed,
                reason,
                roomId,
                session.getId(),
                session.getGuideId(),
                currentUserId,
                guideMatch,
                completedBookingMatch
        );
    }
}

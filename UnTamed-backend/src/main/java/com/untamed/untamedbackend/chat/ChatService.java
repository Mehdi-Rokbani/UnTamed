package com.untamed.untamedbackend.chat;

import com.untamed.untamedbackend.booking.Booking;
import com.untamed.untamedbackend.booking.BookingRepository;
import com.untamed.untamedbackend.booking.BookingStatus;
import com.untamed.untamedbackend.dto.PaginatedResponse;
import com.untamed.untamedbackend.model.ActivityImage;
import com.untamed.untamedbackend.model.ActivitySession;
import com.untamed.untamedbackend.model.ActivityTemplate;
import com.untamed.untamedbackend.model.User;
import com.untamed.untamedbackend.notification.NotificationService;
import com.untamed.untamedbackend.notification.NotificationSeverity;
import com.untamed.untamedbackend.notification.NotificationType;
import com.untamed.untamedbackend.repository.ActivitySessionRepository;
import com.untamed.untamedbackend.repository.ActivityTemplateRepository;
import com.untamed.untamedbackend.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class ChatService {

    private static final int MAX_ROOM_PAGE_SIZE = 50;
    private static final int MAX_MESSAGE_PAGE_SIZE = 100;
    private static final int MESSAGE_MAX_LENGTH = 1000;
    private static final int LAST_MESSAGE_PREVIEW_LENGTH = 140;

    private final ChatRoomRepository chatRoomRepository;
    private final ChatMessageRepository chatMessageRepository;
    private final ActivitySessionRepository activitySessionRepository;
    private final ActivityTemplateRepository activityTemplateRepository;
    private final BookingRepository bookingRepository;
    private final UserRepository userRepository;
    private final SimpMessagingTemplate messagingTemplate;
    private final NotificationService notificationService;

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

    public ChatRoomResponse getOrCreateSessionRoom(String sessionId, String currentUserId) {
        ActivitySession session = getSessionOrThrow(sessionId);
        assertCanAccessSessionChat(session, currentUserId);

        ChatRoom room = chatRoomRepository.findBySessionId(sessionId)
                .map(existing -> refreshRoomMembership(existing, session))
                .orElseGet(() -> createRoom(session));

        return toRoomResponse(room);
    }

    public PaginatedResponse<ChatRoomResponse> listMyRooms(String currentUserId, int page, int size) {
        int safePage = Math.max(0, page);
        int safeSize = Math.max(1, Math.min(size, MAX_ROOM_PAGE_SIZE));

        Map<String, ChatRoom> deduped = new LinkedHashMap<>();
        chatRoomRepository.findByGuideId(currentUserId)
                .forEach(room -> deduped.put(room.getId(), room));
        chatRoomRepository.findByParticipantUserIdsContaining(currentUserId)
                .forEach(room -> deduped.put(room.getId(), room));

        List<ChatRoom> accessibleRooms = deduped.values()
                .stream()
                .map(this::refreshRoomMembershipIfSessionExists)
                .filter(Objects::nonNull)
                .filter(room -> canAccessRoom(room, currentUserId))
                .sorted(Comparator
                        .comparing(this::roomSortTime, Comparator.nullsLast(Comparator.reverseOrder()))
                        .thenComparing(ChatRoom::getId, Comparator.nullsLast(Comparator.naturalOrder())))
                .toList();

        int from = Math.min(safePage * safeSize, accessibleRooms.size());
        int to = Math.min(from + safeSize, accessibleRooms.size());

        List<ChatRoomResponse> content = accessibleRooms.subList(from, to)
                .stream()
                .map(this::toRoomResponse)
                .toList();

        return PaginatedResponse.of(content, safePage, safeSize, accessibleRooms.size());
    }

    public PaginatedResponse<ChatMessageResponse> listMessages(
            String roomId,
            String currentUserId,
            int page,
            int size
    ) {
        ChatRoom room = getRoomOrThrow(roomId);
        assertCanAccessRoom(room, currentUserId);

        int safePage = Math.max(0, page);
        int safeSize = Math.max(1, Math.min(size, MAX_MESSAGE_PAGE_SIZE));
        Page<ChatMessage> messagePage = chatMessageRepository.findByRoomIdOrderByCreatedAtDesc(
                roomId,
                PageRequest.of(safePage, safeSize)
        );

        List<ChatMessage> chronological = new ArrayList<>(messagePage.getContent());
        chronological.sort(Comparator.comparing(ChatMessage::getCreatedAt, Comparator.nullsLast(Comparator.naturalOrder())));

        Map<String, User> usersById = loadUsersById(
                chronological.stream().map(ChatMessage::getSenderId).collect(Collectors.toSet())
        );

        List<ChatMessageResponse> content = chronological.stream()
                .map(message -> toMessageResponse(message, usersById.get(message.getSenderId()), currentUserId))
                .toList();

        return PaginatedResponse.from(messagePage, content);
    }

    public ChatMessageResponse sendMessage(
            String roomId,
            String currentUserId,
            SendChatMessageRequest request
    ) {
        ChatRoom room = getRoomOrThrow(roomId);
        assertCanAccessRoom(room, currentUserId);

        String text = request == null ? null : normalizeMessage(request.message());
        if (text == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Message is required.");
        }
        if (text.length() > MESSAGE_MAX_LENGTH) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Message must be 1000 characters or fewer.");
        }

        User sender = userRepository.findById(currentUserId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found."));

        Instant now = Instant.now();
        ChatMessage message = ChatMessage.builder()
                .roomId(room.getId())
                .sessionId(room.getSessionId())
                .senderId(sender.getId())
                .senderRole(sender.getRole() != null ? sender.getRole().name() : null)
                .type(ChatMessageType.TEXT)
                .message(text)
                .createdAt(now)
                .build();

        ChatMessage savedMessage = chatMessageRepository.save(message);

        room.setLastMessagePreview(buildPreview(text));
        room.setLastMessageAt(now);
        room.setUpdatedAt(now);
        chatRoomRepository.save(room);

        ChatMessageResponse response = toMessageResponse(savedMessage, sender, currentUserId);
        sendRoomPreviewEvent(room, response, sender, "MESSAGE_CREATED");
        notifyChatMessageRecipients(room, sender, text);
        return response;
    }

    public void createSystemMessageForSession(String sessionId, String message) {
        if (sessionId == null || sessionId.isBlank()) {
            return;
        }

        ChatRoom room = chatRoomRepository.findBySessionId(sessionId).orElse(null);
        if (room == null) {
            return;
        }

        String text = normalizeMessage(message);
        if (text == null) {
            return;
        }

        Instant now = Instant.now();
        ChatMessage systemMessage = ChatMessage.builder()
                .roomId(room.getId())
                .sessionId(room.getSessionId())
                .senderId(null)
                .senderRole("SYSTEM")
                .type(ChatMessageType.SYSTEM)
                .message(text)
                .createdAt(now)
                .build();

        ChatMessage savedMessage = chatMessageRepository.save(systemMessage);

        room.setLastMessagePreview(buildPreview(text));
        room.setLastMessageAt(now);
        room.setUpdatedAt(now);
        chatRoomRepository.save(room);

        ChatMessageResponse response = toMessageResponse(savedMessage, null, null);
        messagingTemplate.convertAndSend("/topic/chat/rooms/" + room.getId(), response);
        sendRoomPreviewEvent(room, response, null, "MESSAGE_CREATED");
    }

    public boolean canAccessRoom(String roomId, String currentUserId) {
        return inspectRoomAccess(roomId, currentUserId).allowed();
    }

    public void refreshRoomParticipantsForSession(String sessionId) {
        if (sessionId == null || sessionId.isBlank()) {
            return;
        }

        ChatRoom room = chatRoomRepository.findBySessionId(sessionId).orElse(null);
        if (room == null) {
            return;
        }

        ActivitySession session = activitySessionRepository.findById(sessionId).orElse(null);
        if (session == null) {
            return;
        }

        room.setTemplateId(session.getTemplateId());
        room.setGuideId(session.getGuideId());
        room.setParticipantUserIds(completedBookingUserIds(session.getId(), session.getGuideId()));
        room.setUpdatedAt(Instant.now());
        ChatRoom savedRoom = chatRoomRepository.save(room);
        sendRoomPreviewEvent(savedRoom, null, null, "ROOM_UPDATED");
    }

    public void sendUserRemovedFromSessionChat(String sessionId, String userId, String message) {
        if (sessionId == null || sessionId.isBlank() || userId == null || userId.isBlank()) {
            return;
        }

        ChatRoom room = chatRoomRepository.findBySessionId(sessionId).orElse(null);
        if (room == null) {
            return;
        }

        try {
            ChatRoomMembershipEvent event = new ChatRoomMembershipEvent(
                    room.getId(),
                    room.getSessionId(),
                    userId,
                    "REMOVED",
                    message == null || message.isBlank()
                            ? "You no longer have access to this chat."
                            : message.trim(),
                    Instant.now()
            );
            messagingTemplate.convertAndSendToUser(userId, "/queue/chat-membership", event);
            messagingTemplate.convertAndSendToUser(
                    userId,
                    "/queue/chat-room-previews",
                    new ChatRoomPreviewEvent(
                            room.getId(),
                            room.getSessionId(),
                            null,
                            null,
                            null,
                            null,
                            room.getUpdatedAt(),
                            room.getParticipantUserIds() == null ? 0 : room.getParticipantUserIds().size(),
                            "ROOM_REMOVED"
                    )
            );
        } catch (RuntimeException e) {
            System.out.println("Failed to send chat membership event for user "
                    + userId + " session " + sessionId + ": " + e.getMessage());
        }
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

    private ChatRoom createRoom(ActivitySession session) {
        Instant now = Instant.now();
        ChatRoom room = ChatRoom.builder()
                .sessionId(session.getId())
                .templateId(session.getTemplateId())
                .guideId(session.getGuideId())
                .participantUserIds(completedBookingUserIds(session.getId(), session.getGuideId()))
                .createdAt(now)
                .updatedAt(now)
                .build();

        try {
            return chatRoomRepository.save(room);
        } catch (DuplicateKeyException e) {
            return chatRoomRepository.findBySessionId(session.getId())
                    .map(existing -> refreshRoomMembership(existing, session))
                    .orElseThrow(() -> e);
        }
    }

    private ChatRoom refreshRoomMembershipIfSessionExists(ChatRoom room) {
        ActivitySession session = activitySessionRepository.findById(room.getSessionId()).orElse(null);
        if (session == null) {
            return null;
        }
        return refreshRoomMembership(room, session);
    }

    private ChatRoom refreshRoomMembership(ChatRoom room, ActivitySession session) {
        List<String> participantUserIds = completedBookingUserIds(session.getId(), session.getGuideId());
        boolean changed = !Objects.equals(room.getTemplateId(), session.getTemplateId())
                || !Objects.equals(room.getGuideId(), session.getGuideId())
                || !Objects.equals(room.getParticipantUserIds(), participantUserIds);

        if (!changed) {
            return room;
        }

        room.setTemplateId(session.getTemplateId());
        room.setGuideId(session.getGuideId());
        room.setParticipantUserIds(participantUserIds);
        room.setUpdatedAt(Instant.now());
        return chatRoomRepository.save(room);
    }

    private List<String> completedBookingUserIds(String sessionId, String guideId) {
        return bookingRepository.findBySessionIdAndStatusOrderByCreatedAtAsc(sessionId, BookingStatus.COMPLETED)
                .stream()
                .map(Booking::getUserId)
                .filter(userId -> userId != null && !userId.isBlank())
                .filter(userId -> !userId.equals(guideId))
                .distinct()
                .toList();
    }

    private void assertCanAccessRoom(ChatRoom room, String currentUserId) {
        if (!canAccessRoom(room, currentUserId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "You cannot access this chat room.");
        }
    }

    private boolean canAccessRoom(ChatRoom room, String currentUserId) {
        if (room == null || currentUserId == null || currentUserId.isBlank()) {
            return false;
        }

        ActivitySession session = activitySessionRepository.findById(room.getSessionId()).orElse(null);
        if (session == null) {
            return false;
        }

        return canAccessSessionChat(session, currentUserId);
    }

    private void assertCanAccessSessionChat(ActivitySession session, String currentUserId) {
        if (!canAccessSessionChat(session, currentUserId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "You cannot access this session chat.");
        }
    }

    private boolean canAccessSessionChat(ActivitySession session, String currentUserId) {
        if (session == null || currentUserId == null || currentUserId.isBlank()) {
            return false;
        }

        if (currentUserId.equals(session.getGuideId())) {
            return true;
        }

        return bookingRepository.existsBySessionIdAndUserIdAndStatus(
                session.getId(),
                currentUserId,
                BookingStatus.COMPLETED
        );
    }

    private ActivitySession getSessionOrThrow(String sessionId) {
        return activitySessionRepository.findById(sessionId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Session not found."));
    }

    private ChatRoom getRoomOrThrow(String roomId) {
        return chatRoomRepository.findById(roomId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Chat room not found."));
    }

    private ChatRoomResponse toRoomResponse(ChatRoom room) {
        ActivityTemplate template = room.getTemplateId() == null
                ? null
                : activityTemplateRepository.findById(room.getTemplateId()).orElse(null);

        return new ChatRoomResponse(
                room.getId(),
                room.getSessionId(),
                room.getTemplateId(),
                room.getGuideId(),
                template != null ? template.getTitle() : null,
                coverImageUrl(template),
                room.getParticipantUserIds() == null ? 0 : room.getParticipantUserIds().size(),
                room.getLastMessagePreview(),
                room.getLastMessageAt(),
                room.getCreatedAt(),
                room.getUpdatedAt()
        );
    }

    private ChatMessageResponse toMessageResponse(ChatMessage message, User sender, String currentUserId) {
        return new ChatMessageResponse(
                message.getId(),
                message.getRoomId(),
                message.getSessionId(),
                message.getSenderId(),
                sender != null ? sender.getUsername() : null,
                sender != null ? sender.getProfileImageUrl() : null,
                message.getSenderRole(),
                message.getType() == null ? ChatMessageType.TEXT : message.getType(),
                message.getMessage(),
                message.getType() != ChatMessageType.SYSTEM
                        && message.getSenderId() != null
                        && message.getSenderId().equals(currentUserId),
                message.getCreatedAt()
        );
    }

    private void notifyChatMessageRecipients(ChatRoom room, User sender, String message) {
        if (room == null || sender == null || sender.getId() == null || message == null) {
            return;
        }

        try {
            LinkedHashSet<String> recipientIds = roomRecipientIds(room);
            recipientIds.remove(sender.getId());
            if (recipientIds.isEmpty()) {
                return;
            }

            Map<String, User> usersById = loadUsersById(recipientIds);
            String title = "New message in " + activityTitleForNotification(room);
            String notificationMessage = senderName(sender) + ": " + chatNotificationPreview(message);

            recipientIds.stream()
                    .map(usersById::get)
                    .filter(Objects::nonNull)
                    .filter(user -> user.isEnabled() && !user.isSuspended())
                    .forEach(user -> notificationService.createAndSend(
                            user.getId(),
                            NotificationType.CHAT_MESSAGE,
                            title,
                            notificationMessage,
                            NotificationSeverity.INFO,
                            "/chat/rooms/" + room.getId(),
                            "CHAT_ROOM",
                            room.getId()
                    ));
        } catch (RuntimeException e) {
            System.out.println("Failed to create chat message notifications for room "
                    + room.getId() + ": " + e.getMessage());
        }
    }

    private void sendRoomPreviewEvent(
            ChatRoom room,
            ChatMessageResponse message,
            User sender,
            String type
    ) {
        if (room == null || room.getId() == null) {
            return;
        }

        try {
            LinkedHashSet<String> recipientIds = roomRecipientIds(room);
            if (recipientIds.isEmpty()) {
                return;
            }

            ChatRoomPreviewEvent event = new ChatRoomPreviewEvent(
                    room.getId(),
                    room.getSessionId(),
                    message != null ? message.id() : null,
                    message != null ? message.message() : room.getLastMessagePreview(),
                    sender != null ? sender.getId() : message != null ? message.senderId() : null,
                    sender != null ? senderName(sender) : message != null ? message.senderUsername() : null,
                    message != null ? message.createdAt() : room.getLastMessageAt(),
                    room.getParticipantUserIds() == null ? 0 : room.getParticipantUserIds().size(),
                    type
            );

            recipientIds.forEach(userId ->
                    messagingTemplate.convertAndSendToUser(userId, "/queue/chat-room-previews", event)
            );
        } catch (RuntimeException e) {
            System.out.println("Failed to send chat room preview event for room "
                    + room.getId() + ": " + e.getMessage());
        }
    }

    private LinkedHashSet<String> roomRecipientIds(ChatRoom room) {
        LinkedHashSet<String> recipientIds = new LinkedHashSet<>();
        if (room.getGuideId() != null && !room.getGuideId().isBlank()) {
            recipientIds.add(room.getGuideId());
        }
        if (room.getParticipantUserIds() != null) {
            room.getParticipantUserIds().stream()
                    .filter(userId -> userId != null && !userId.isBlank())
                    .forEach(recipientIds::add);
        }
        return recipientIds;
    }

    private String activityTitleForNotification(ChatRoom room) {
        ActivityTemplate template = room.getTemplateId() == null
                ? null
                : activityTemplateRepository.findById(room.getTemplateId()).orElse(null);
        if (template != null && template.getTitle() != null && !template.getTitle().isBlank()) {
            return template.getTitle();
        }
        return "your trip chat";
    }

    private String senderName(User sender) {
        return sender.getUsername() != null && !sender.getUsername().isBlank()
                ? sender.getUsername()
                : "A traveler";
    }

    private String chatNotificationPreview(String message) {
        String compact = message == null ? "" : message.replaceAll("\\s+", " ").trim();
        int maxLength = 96;
        if (compact.length() <= maxLength) {
            return compact;
        }
        return compact.substring(0, maxLength - 1) + "…";
    }

    private Map<String, User> loadUsersById(Set<String> userIds) {
        if (userIds == null || userIds.isEmpty()) {
            return Map.of();
        }

        Set<String> safeUserIds = userIds.stream()
                .filter(userId -> userId != null && !userId.isBlank())
                .collect(Collectors.toSet());
        if (safeUserIds.isEmpty()) {
            return Map.of();
        }

        return userRepository.findAllById(safeUserIds)
                .stream()
                .collect(Collectors.toMap(User::getId, Function.identity()));
    }

    private String coverImageUrl(ActivityTemplate template) {
        if (template == null || template.getImages() == null || template.getImages().isEmpty()) {
            return null;
        }

        return template.getImages()
                .stream()
                .filter(ActivityImage::isCover)
                .findFirst()
                .or(() -> template.getImages().stream().findFirst())
                .map(ActivityImage::getUrl)
                .orElse(null);
    }

    private Instant roomSortTime(ChatRoom room) {
        if (room.getLastMessageAt() != null) {
            return room.getLastMessageAt();
        }
        if (room.getUpdatedAt() != null) {
            return room.getUpdatedAt();
        }
        return room.getCreatedAt();
    }

    private String normalizeMessage(String value) {
        if (value == null) {
            return null;
        }

        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    private String buildPreview(String message) {
        if (message.length() <= LAST_MESSAGE_PREVIEW_LENGTH) {
            return message;
        }
        return message.substring(0, LAST_MESSAGE_PREVIEW_LENGTH - 1) + "...";
    }
}

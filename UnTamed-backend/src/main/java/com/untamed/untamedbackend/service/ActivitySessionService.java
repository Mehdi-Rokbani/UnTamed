package com.untamed.untamedbackend.service;

import com.untamed.untamedbackend.booking.Booking;
import com.untamed.untamedbackend.booking.BookingRepository;
import com.untamed.untamedbackend.booking.BookingStatus;
import com.untamed.untamedbackend.booking.SessionSeatOps;
import com.untamed.untamedbackend.chat.ChatService;
import com.untamed.untamedbackend.dto.ActivitySessionCreateRequest;
import com.untamed.untamedbackend.dto.ActivitySessionDeleteAction;
import com.untamed.untamedbackend.dto.ActivitySessionDeleteResponse;
import com.untamed.untamedbackend.dto.ActivitySessionResponse;
import com.untamed.untamedbackend.dto.ActivitySessionUpdateRequest;
import com.untamed.untamedbackend.dto.ActivityTemplateMiniDto;
import com.untamed.untamedbackend.dto.GuideAttendanceSummaryDto;
import com.untamed.untamedbackend.dto.GuidePassAttendanceDto;
import com.untamed.untamedbackend.dto.GuideParticipantDto;
import com.untamed.untamedbackend.dto.GuideSessionDetailsResponse;
import com.untamed.untamedbackend.dto.RatingSummaryDto;
import com.untamed.untamedbackend.dto.PaginatedResponse;
import com.untamed.untamedbackend.guestpass.AttendanceStatus;
import com.untamed.untamedbackend.guestpass.GuestPass;
import com.untamed.untamedbackend.guestpass.GuestPassRepository;
import com.untamed.untamedbackend.guestpass.GuestPassStatus;
import com.untamed.untamedbackend.model.ActivityImage;
import com.untamed.untamedbackend.model.ActivitySession;
import com.untamed.untamedbackend.model.ActivityStatus;
import com.untamed.untamedbackend.model.ActivityTemplate;
import com.untamed.untamedbackend.model.RatingSummary;
import com.untamed.untamedbackend.model.Role;
import com.untamed.untamedbackend.model.User;
import com.untamed.untamedbackend.notification.NotificationService;
import com.untamed.untamedbackend.notification.NotificationSeverity;
import com.untamed.untamedbackend.notification.NotificationType;
import com.untamed.untamedbackend.repository.ActivitySessionRepository;
import com.untamed.untamedbackend.repository.ActivityTemplateRepository;
import com.untamed.untamedbackend.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.Collection;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class ActivitySessionService {

    private static final List<BookingStatus> ACTIVE_NOTIFICATION_BOOKING_STATUSES = List.of(
            BookingStatus.PENDING,
            BookingStatus.PAYING,
            BookingStatus.COMPLETED
    );
    private static final DateTimeFormatter NOTIFICATION_DATE_TIME_FORMAT =
            DateTimeFormatter.ofPattern("MMM d, yyyy 'at' h:mm a 'UTC'").withZone(ZoneOffset.UTC);

    private final ActivitySessionRepository sessionRepo;
    private final ActivityTemplateRepository templateRepo;
    private final UserRepository userRepo;
    private final BookingRepository bookingRepo;
    private final SessionSeatOps sessionSeatOps;
    private final GuestPassRepository guestPassRepo;
    private final NotificationService notificationService;
    private final ChatService chatService;

    // -------- Guide dashboard lists --------

    public List<ActivitySessionResponse> listMinePast(String authEmail) {
        User guide = getGuideByEmail(authEmail);
        Instant now = Instant.now();

        return sessionRepo.findByGuideId(guide.getId())
                .stream()
                .filter(s ->
                        (s.getStartAt() != null && s.getStartAt().isBefore(now))
                                || s.getStatus() == ActivityStatus.COMPLETED
                                || s.getStatus() == ActivityStatus.CANCELLED
                )
                .sorted(Comparator.comparing(
                        ActivitySession::getStartAt,
                        Comparator.nullsLast(Comparator.reverseOrder())
                ))
                .map(this::toSessionResponse)
                .toList();
    }

    public List<ActivitySessionResponse> listMineUpcoming(String authEmail) {
        User guide = getGuideByEmail(authEmail);
        Instant now = Instant.now();

        return sessionRepo.findByGuideId(guide.getId())
                .stream()
                .filter(s ->
                        s.getStartAt() != null
                                && s.getStartAt().isAfter(now)
                                && s.getStatus() != ActivityStatus.COMPLETED
                                && s.getStatus() != ActivityStatus.CANCELLED
                )
                .sorted(Comparator.comparing(ActivitySession::getStartAt))
                .map(this::toSessionResponse)
                .toList();
    }

    public List<ActivitySessionResponse> listMine(String authEmail) {
        User guide = getGuideByEmail(authEmail);

        return sessionRepo.findByGuideId(guide.getId())
                .stream()
                .sorted(Comparator.comparing(
                        ActivitySession::getStartAt,
                        Comparator.nullsLast(Comparator.naturalOrder())
                ))
                .map(this::toSessionResponse)
                .toList();
    }

    public PaginatedResponse<ActivitySessionResponse> listMinePage(String authEmail, int page, int size) {
        User guide = getGuideByEmail(authEmail);
        Page<ActivitySession> sessionPage = sessionRepo.findByGuideId(
                guide.getId(),
                PageRequest.of(page, size, Sort.by(Sort.Direction.ASC, "startAt"))
        );

        List<ActivitySessionResponse> content = sessionPage.getContent()
                .stream()
                .map(this::toSessionResponse)
                .toList();

        return PaginatedResponse.from(sessionPage, content);
    }

    // -------- Public sessions --------

    public List<ActivitySessionResponse> listPublished() {
        return sessionRepo.findByStatus(ActivityStatus.PUBLISHED)
                .stream()
                .filter(s -> isTemplatePubliclyVisible(s.getTemplateId()))
                .map(this::toSessionResponse)
                .toList();
    }

    public ActivitySessionResponse getSessionById(String sessionId, String authEmailOrNull) {
        ActivitySession s = sessionRepo.findById(sessionId)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND,
                        "Session not found"
                ));

        if (s.getStatus() != ActivityStatus.PUBLISHED || !isTemplatePubliclyVisible(s.getTemplateId())) {
            if (authEmailOrNull == null) {
                throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Session not found");
            }

            User u = userRepo.findByEmail(authEmailOrNull)
                    .orElseThrow(() -> new ResponseStatusException(
                            HttpStatus.NOT_FOUND,
                            "User not found"
                    ));

            if (!s.getGuideId().equals(u.getId())) {
                throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Session not found");
            }
        }

        return toSessionResponse(s);
    }

    // -------- Guide session details --------

    public GuideSessionDetailsResponse getGuideSessionDetails(String sessionId, String authEmail) {
        User guide = getGuideByEmail(authEmail);

        ActivitySession session = sessionRepo.findByIdAndGuideId(sessionId, guide.getId())
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND,
                        "Session not found"
                ));

        List<Booking> bookings = bookingRepo.findBySessionIdOrderByCreatedAtAsc(sessionId);
        List<GuestPass> passes = guestPassRepo.findBySessionIdOrderByPassNumberAsc(sessionId);
        Map<String, List<GuidePassAttendanceDto>> passesByBooking = passes.stream()
                .collect(Collectors.groupingBy(
                        GuestPass::getBookingId,
                        Collectors.mapping(this::toGuidePassAttendanceDto, Collectors.toList())
                ));

        List<GuideParticipantDto> bookingDtos = bookings.stream()
                .map(booking -> {
                    User user = userRepo.findById(booking.getUserId()).orElse(null);

                    return new GuideParticipantDto(
                            booking.getId(),
                            booking.getUserId(),
                            user != null ? user.getUsername() : null,
                            user != null ? user.getEmail() : booking.getUserId(),
                            user != null ? user.getProfileImageUrl() : null,
                            booking.getNumberOfPeople(),
                            booking.getStatus(),
                            booking.getCreatedAt(),
                            passesByBooking.getOrDefault(booking.getId(), List.of())
                    );
                })
                .toList();

        int totalPeople = bookings.stream()
                .mapToInt(Booking::getNumberOfPeople)
                .sum();

        return new GuideSessionDetailsResponse(
                toSessionResponse(session),
                bookingDtos,
                bookings.size(),
                totalPeople,
                countStatus(bookings, BookingStatus.PENDING),
                countStatus(bookings, BookingStatus.PAYING),
                countStatus(bookings, BookingStatus.COMPLETED),
                countStatus(bookings, BookingStatus.CANCELLED),
                countStatus(bookings, BookingStatus.EXPIRED),
                buildAttendanceSummary(passes)
        );
    }

    private GuidePassAttendanceDto toGuidePassAttendanceDto(GuestPass pass) {
        return new GuidePassAttendanceDto(
                pass.getId(),
                pass.getBookingId(),
                pass.getGuestName(),
                pass.getPassNumber(),
                pass.getTotalPasses(),
                pass.isMainBooker(),
                pass.getStatus(),
                pass.getAttendanceStatus(),
                pass.getMarkedAt(),
                pass.getMarkedByGuideId()
        );
    }

    private GuideAttendanceSummaryDto buildAttendanceSummary(List<GuestPass> passes) {
        List<GuestPass> activePasses = passes.stream()
                .filter(pass -> pass.getStatus() == GuestPassStatus.ACTIVE)
                .toList();
        int present = (int) activePasses.stream()
                .filter(pass -> pass.getAttendanceStatus() == AttendanceStatus.PRESENT)
                .count();
        int absent = (int) activePasses.stream()
                .filter(pass -> pass.getAttendanceStatus() == AttendanceStatus.ABSENT)
                .count();
        int notCheckedIn = (int) activePasses.stream()
                .filter(pass -> pass.getAttendanceStatus() == AttendanceStatus.NOT_MARKED)
                .count();

        return new GuideAttendanceSummaryDto(
                activePasses.size(),
                present,
                absent,
                notCheckedIn
        );
    }

    // -------- Create / update --------

    public ActivitySessionResponse createSession(
            String templateId,
            ActivitySessionCreateRequest req,
            String authEmail
    ) {
        User guide = getGuideByEmail(authEmail);

        ActivityTemplate t = templateRepo.findByIdAndGuideId(templateId, guide.getId())
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND,
                        "Not allowed or template not found"
                ));

        if (t.isArchived()) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "Cannot create sessions for an archived activity."
            );
        }

        validateCreateRequest(req);

        ActivitySession s = ActivitySession.builder()
                .templateId(t.getId())
                .guideId(t.getGuideId())
                .startAt(req.startAt())
                .endAt(req.endAt())
                .capacity(req.capacity())
                .bookedCount(0)
                .status(ActivityStatus.DRAFT)
                .meetingPoint(normalize(req.meetingPoint()))
                .sessionNote(normalize(req.sessionNote()))
                .build();

        return toSessionResponse(sessionRepo.save(s));
    }

    public ActivitySessionResponse updateSession(
            String sessionId,
            ActivitySessionUpdateRequest req,
            String authEmail
    ) {
        User guide = getGuideByEmail(authEmail);

        ActivitySession s = sessionRepo.findByIdAndGuideId(sessionId, guide.getId())
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND,
                        "Not allowed or session not found"
                ));

        validateEditableSession(s, req);

        Instant finalStartAt = req.startAt() != null ? req.startAt() : s.getStartAt();
        Instant finalEndAt = req.endAt() != null ? req.endAt() : s.getEndAt();
        Integer finalCapacity = req.capacity() != null ? req.capacity() : s.getCapacity();

        validateTimeRange(finalStartAt, finalEndAt);

        if (finalStartAt != null && !finalStartAt.isAfter(Instant.now())) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Start time must be in the future."
            );
        }

        if (finalCapacity == null || finalCapacity < 1) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Capacity must be >= 1."
            );
        }

        if (finalCapacity < s.getBookedCount()) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "Capacity cannot be lower than booked seats."
            );
        }

        if (req.status() == ActivityStatus.PUBLISHED) {
            ensureTemplateIsPublishable(s.getTemplateId());
        }

        Instant oldStartAt = s.getStartAt();
        Instant oldEndAt = s.getEndAt();
        ActivityStatus oldStatus = s.getStatus();

        if (req.startAt() != null) {
            s.setStartAt(req.startAt());
        }

        if (req.endAt() != null) {
            s.setEndAt(req.endAt());
        }

        if (req.capacity() != null) {
            s.setCapacity(req.capacity());
        }

        if (req.meetingPoint() != null) {
            s.setMeetingPoint(normalize(req.meetingPoint()));
        }

        if (req.sessionNote() != null) {
            s.setSessionNote(normalize(req.sessionNote()));
        }

        if (req.status() != null) {
            s.setStatus(req.status());
        }

        ActivitySession savedSession = sessionRepo.save(s);
        notifySessionChangeIfNeeded(savedSession, oldStartAt, oldEndAt, oldStatus);

        return toSessionResponse(savedSession);
    }

    public ActivitySessionResponse setStatus(String sessionId, ActivityStatus status, String authEmail) {
        if (status == ActivityStatus.CANCELLED) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Use the cancel session endpoint."
            );
        }

        return updateSession(
                sessionId,
                new ActivitySessionUpdateRequest(null, null, null, status, null, null),
                authEmail
        );
    }

    // -------- Safe delete / cancel --------

    public ActivitySessionDeleteResponse deleteOrCancelSession(String sessionId, String authEmail) {
        User guide = getGuideByEmail(authEmail);

        ActivitySession session = sessionRepo.findByIdAndGuideId(sessionId, guide.getId())
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND,
                        "Session not found"
                ));

        if (session.getStatus() == ActivityStatus.CANCELLED) {
            return new ActivitySessionDeleteResponse(
                    sessionId,
                    ActivitySessionDeleteAction.KEPT_HISTORY,
                    "This session is already cancelled. Restore it or delete it permanently from history."
            );
        }

        if (session.getStatus() == ActivityStatus.COMPLETED) {
            return new ActivitySessionDeleteResponse(
                    sessionId,
                    ActivitySessionDeleteAction.KEPT_HISTORY,
                    "Completed sessions are kept for history."
            );
        }

        Instant now = Instant.now();
        boolean isPast = session.getEndAt() != null && !session.getEndAt().isAfter(now);

        if (isPast) {
            return new ActivitySessionDeleteResponse(
                    sessionId,
                    ActivitySessionDeleteAction.KEPT_HISTORY,
                    "Past sessions are kept for history."
            );
        }

        List<Booking> bookings = bookingRepo.findBySessionIdOrderByCreatedAtAsc(sessionId);

        if (bookings.isEmpty()) {
            sessionRepo.deleteById(sessionId);

            return new ActivitySessionDeleteResponse(
                    sessionId,
                    ActivitySessionDeleteAction.DELETED,
                    "Session deleted successfully."
            );
        }

        boolean hasPaying = bookings.stream()
                .anyMatch(b -> b.getStatus() == BookingStatus.PAYING);

        if (hasPaying) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "Cannot cancel this session because at least one booking is currently in payment."
            );
        }

        boolean hasCompleted = bookings.stream()
                .anyMatch(b -> b.getStatus() == BookingStatus.COMPLETED);

        if (hasCompleted) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "Cannot cancel this session because it has confirmed bookings. Contact participants or wait until the session ends."
            );
        }

        boolean hasOnlyCancelledOrExpired = bookings.stream()
                .allMatch(b ->
                        b.getStatus() == BookingStatus.CANCELLED ||
                                b.getStatus() == BookingStatus.EXPIRED
                );

        if (hasOnlyCancelledOrExpired) {
            return new ActivitySessionDeleteResponse(
                    sessionId,
                    ActivitySessionDeleteAction.KEPT_HISTORY,
                    "This session only has cancelled or expired bookings. Restore it or delete it permanently from history."
            );
        }

        List<Booking> pendingBookings = bookings.stream()
                .filter(b -> b.getStatus() == BookingStatus.PENDING)
                .toList();

        if (pendingBookings.isEmpty()) {
            return new ActivitySessionDeleteResponse(
                    sessionId,
                    ActivitySessionDeleteAction.KEPT_HISTORY,
                    "Session was kept for history."
            );
        }

        int seatsToRelease = pendingBookings.stream()
                .mapToInt(Booking::getNumberOfPeople)
                .sum();

        if (seatsToRelease > 0) {
            sessionSeatOps.releaseSeats(sessionId, seatsToRelease);
        }

        Instant updateTime = Instant.now();

        for (Booking booking : pendingBookings) {
            booking.setNumberOfPeople(0);
            booking.setStatus(BookingStatus.CANCELLED);
            booking.setUpdatedAt(updateTime);
            booking.setExpiresAt(null);
        }

        bookingRepo.saveAll(pendingBookings);

        Instant oldStartAt = session.getStartAt();
        Instant oldEndAt = session.getEndAt();
        ActivityStatus oldStatus = session.getStatus();

        session.setStatus(ActivityStatus.CANCELLED);
        session.setBookedCount(0);
        ActivitySession savedSession = sessionRepo.save(session);
        notifySessionChangeIfNeeded(savedSession, oldStartAt, oldEndAt, oldStatus);

        return new ActivitySessionDeleteResponse(
                sessionId,
                ActivitySessionDeleteAction.CANCELLED,
                "Session was cancelled. Pending bookings were cancelled and seats were released."
        );
    }
    public ActivitySessionResponse restoreCancelledSession(String sessionId, String authEmail) {
        User guide = getGuideByEmail(authEmail);

        ActivitySession session = sessionRepo.findByIdAndGuideId(sessionId, guide.getId())
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND,
                        "Session not found"
                ));

        if (session.getStatus() != ActivityStatus.CANCELLED) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "Only cancelled sessions can be restored."
            );
        }

        Instant now = Instant.now();
        boolean isPast = session.getEndAt() != null && !session.getEndAt().isAfter(now);

        if (isPast) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "Cannot restore a past session."
            );
        }

        ActivityTemplate template = templateRepo.findById(session.getTemplateId())
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND,
                        "Template not found for this session."
                ));

        if (template.isArchived()) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "Cannot restore sessions of an archived activity."
            );
        }

        List<Booking> bookings = bookingRepo.findBySessionIdOrderByCreatedAtAsc(sessionId);

        boolean hasActiveBookings = bookings.stream()
                .anyMatch(b ->
                        b.getStatus() == BookingStatus.PENDING ||
                                b.getStatus() == BookingStatus.PAYING ||
                                b.getStatus() == BookingStatus.COMPLETED
                );

        if (hasActiveBookings) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "Cannot restore this session because it still has active or confirmed bookings."
            );
        }

        session.setStatus(ActivityStatus.DRAFT);
        session.setBookedCount(0);

        return toSessionResponse(sessionRepo.save(session));
    }
    public ActivitySessionDeleteResponse permanentlyDeleteCancelledSession(String sessionId, String authEmail) {
        User guide = getGuideByEmail(authEmail);

        ActivitySession session = sessionRepo.findByIdAndGuideId(sessionId, guide.getId())
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND,
                        "Session not found"
                ));

        if (session.getStatus() != ActivityStatus.CANCELLED) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "Only cancelled sessions can be permanently deleted."
            );
        }

        Instant now = Instant.now();
        boolean isPast = session.getEndAt() != null && !session.getEndAt().isAfter(now);

        if (isPast) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "Past sessions are kept for history and cannot be permanently deleted from this action."
            );
        }

        List<Booking> bookings = bookingRepo.findBySessionIdOrderByCreatedAtAsc(sessionId);

        boolean hasBlockingBookings = bookings.stream()
                .anyMatch(b ->
                        b.getStatus() == BookingStatus.PENDING ||
                                b.getStatus() == BookingStatus.PAYING ||
                                b.getStatus() == BookingStatus.COMPLETED
                );

        if (hasBlockingBookings) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "Cannot permanently delete this session because it still has active or confirmed bookings."
            );
        }

        if (!bookings.isEmpty()) {
            bookingRepo.deleteAll(bookings);
        }

        sessionRepo.deleteById(sessionId);

        return new ActivitySessionDeleteResponse(
                sessionId,
                ActivitySessionDeleteAction.DELETED,
                "Cancelled session and its cancelled booking history were permanently deleted."
        );
    }

    // -------- Validation helpers --------

    private void validateCreateRequest(ActivitySessionCreateRequest req) {
        if (req.startAt() == null || !req.startAt().isAfter(Instant.now())) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Start time must be in the future."
            );
        }

        if (req.capacity() < 1) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Capacity must be >= 1."
            );
        }

        validateTimeRange(req.startAt(), req.endAt());
    }

    private void validateEditableSession(ActivitySession session, ActivitySessionUpdateRequest req) {
        if (session.getStatus() == ActivityStatus.CANCELLED) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "Cannot edit a cancelled session."
            );
        }

        if (session.getStatus() == ActivityStatus.COMPLETED) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "Cannot edit a completed session."
            );
        }

        if (req.status() == ActivityStatus.CANCELLED) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Use the cancel session endpoint."
            );
        }

        ActivityTemplate template = templateRepo.findById(session.getTemplateId())
                .orElse(null);

        if (template == null) {
            throw new ResponseStatusException(
                    HttpStatus.NOT_FOUND,
                    "Template not found for this session."
            );
        }

        if (template.isArchived()) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "Cannot edit sessions of an archived activity."
            );
        }
    }

    private void validateTimeRange(Instant startAt, Instant endAt) {
        if (startAt == null) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Start time is required."
            );
        }

        if (endAt == null) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "End time is required."
            );
        }

        if (!endAt.isAfter(startAt)) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "End time must be after start time."
            );
        }
    }

    private void ensureTemplateIsPublishable(String templateId) {
        ActivityTemplate t = templateRepo.findById(templateId)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND,
                        "Template not found"
                ));

        if (t.isArchived()) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "Cannot publish sessions for an archived activity."
            );
        }

        if (t.getAddressId() == null || t.getAddressId().isBlank()) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Template must have a location before publishing sessions."
            );
        }

        if (t.getLocation() == null) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Template must have coordinates before publishing sessions."
            );
        }

        if (t.getImages() == null || t.getImages().isEmpty()) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Template must have at least one image before publishing sessions."
            );
        }

        if (t.getCategoryIds() == null || t.getCategoryIds().isEmpty()) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Template must have at least one category before publishing sessions."
            );
        }
    }

    private void notifySessionChangeIfNeeded(
            ActivitySession session,
            Instant oldStartAt,
            Instant oldEndAt,
            ActivityStatus oldStatus
    ) {
        boolean cancelled = oldStatus != ActivityStatus.CANCELLED
                && session.getStatus() == ActivityStatus.CANCELLED;
        boolean rescheduled = !cancelled
                && (!Objects.equals(oldStartAt, session.getStartAt())
                || !Objects.equals(oldEndAt, session.getEndAt()));

        if (!cancelled && !rescheduled) {
            return;
        }

        createChatSystemMessage(
                session.getId(),
                cancelled ? "This session was cancelled." : "This session time was updated."
        );

        try {
            String title = activityTitle(session);
            Collection<String> recipientIds = affectedBookingUserIds(session);
            if (recipientIds.isEmpty()) {
                return;
            }

            if (cancelled) {
                notificationService.notifyUsers(
                        recipientIds,
                        NotificationType.SESSION_CANCELLED,
                        "Session cancelled",
                        "Your " + title + " session was cancelled.",
                        NotificationSeverity.ERROR,
                        "/my-bookings",
                        "SESSION",
                        session.getId()
                );
                return;
            }

            notificationService.notifyUsers(
                    recipientIds,
                    NotificationType.SESSION_RESCHEDULED,
                    "Session time changed",
                    "Your " + title + " session was moved to " + formatNotificationDateTime(session.getStartAt()) + ".",
                    NotificationSeverity.WARNING,
                    "/my-bookings",
                    "SESSION",
                    session.getId()
            );
        } catch (RuntimeException e) {
            System.out.println("Failed to create session change notifications for session "
                    + session.getId() + ": " + e.getMessage());
        }
    }

    private void createChatSystemMessage(String sessionId, String message) {
        try {
            chatService.createSystemMessageForSession(sessionId, message);
        } catch (RuntimeException e) {
            System.out.println("Failed to create chat system message for session "
                    + sessionId + ": " + e.getMessage());
        }
    }

    private Collection<String> affectedBookingUserIds(ActivitySession session) {
        return bookingRepo.findBySessionIdAndStatusInOrderByCreatedAtAsc(
                        session.getId(),
                        ACTIVE_NOTIFICATION_BOOKING_STATUSES
                )
                .stream()
                .map(Booking::getUserId)
                .filter(userId -> userId != null && !userId.isBlank())
                .filter(userId -> !userId.equals(session.getGuideId()))
                .distinct()
                .toList();
    }

    private String activityTitle(ActivitySession session) {
        return templateRepo.findById(session.getTemplateId())
                .map(ActivityTemplate::getTitle)
                .filter(title -> !title.isBlank())
                .orElse("activity");
    }

    private String formatNotificationDateTime(Instant value) {
        if (value == null) {
            return "the new time";
        }
        return NOTIFICATION_DATE_TIME_FORMAT.format(value);
    }

    // -------- Small helpers --------

    private boolean isTemplatePubliclyVisible(String templateId) {
        return templateRepo.findById(templateId)
                .map(t -> !t.isArchived())
                .orElse(false);
    }

    private int countStatus(List<Booking> bookings, BookingStatus status) {
        return (int) bookings.stream()
                .filter(b -> b.getStatus() == status)
                .count();
    }

    private String normalize(String value) {
        if (value == null) {
            return null;
        }

        String trimmed = value.trim();

        return trimmed.isEmpty() ? null : trimmed;
    }

    private User getGuideByEmail(String authEmail) {
        User u = userRepo.findByEmail(authEmail)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND,
                        "User not found"
                ));

        if (u.getRole() != Role.GUIDE) {
            throw new ResponseStatusException(
                    HttpStatus.FORBIDDEN,
                    "Only GUIDE can manage activities."
            );
        }

        return u;
    }

    private ActivitySessionResponse toSessionResponse(ActivitySession s) {
        ActivityTemplate t = templateRepo.findById(s.getTemplateId()).orElse(null);

        RatingSummaryDto ratingDto = new RatingSummaryDto(0.0, 0);
        ActivityTemplateMiniDto tplMini = null;

        if (t != null) {
            RatingSummary r = t.getRating() == null
                    ? RatingSummary.builder().average(0.0).count(0).build()
                    : t.getRating();

            ratingDto = new RatingSummaryDto(r.getAverage(), r.getCount());

            tplMini = new ActivityTemplateMiniDto(
                    t.getId(),
                    t.getTitle(),
                    t.getPrice(),
                    t.getDifficulty(),
                    t.getGuideId(),
                    t.getTags(),
                    t.getImages() == null
                            ? null
                            : t.getImages().stream()
                            .filter(ActivityImage::isCover)
                            .findFirst()
                            .map(ActivityImage::getUrl)
                            .orElse(null),
                    t.getCategoryIds()
            );
        }

        return new ActivitySessionResponse(
                s.getId(),
                s.getTemplateId(),
                s.getGuideId(),
                s.getStartAt(),
                s.getEndAt(),
                s.getCapacity(),
                s.getBookedCount(),
                s.getStatus(),
                s.getMeetingPoint(),
                s.getSessionNote(),
                tplMini,
                ratingDto
        );
    }
}

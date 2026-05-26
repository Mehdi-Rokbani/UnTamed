package com.untamed.untamedbackend.report;

import com.untamed.untamedbackend.booking.Booking;
import com.untamed.untamedbackend.booking.BookingRepository;
import com.untamed.untamedbackend.booking.BookingStatus;
import com.untamed.untamedbackend.chat.ChatRoom;
import com.untamed.untamedbackend.chat.ChatRoomRepository;
import com.untamed.untamedbackend.model.ActivitySession;
import com.untamed.untamedbackend.model.ActivityTemplate;
import com.untamed.untamedbackend.model.Role;
import com.untamed.untamedbackend.model.User;
import com.untamed.untamedbackend.repository.ActivitySessionRepository;
import com.untamed.untamedbackend.repository.ActivityTemplateRepository;
import com.untamed.untamedbackend.repository.UserRepository;
import com.untamed.untamedbackend.security.AuthenticatedUser;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.Objects;

@Service
@RequiredArgsConstructor
public class ReportService {

    private final ReportRepository reportRepository;
    private final UserRepository userRepository;
    private final ActivityTemplateRepository activityTemplateRepository;
    private final ActivitySessionRepository activitySessionRepository;
    private final BookingRepository bookingRepository;
    private final ChatRoomRepository chatRoomRepository;

    public ReportResponse createReport(CreateReportRequest request, Authentication authentication) {
        User reporter = requireCurrentUser(authentication);
        ReportTargetType targetType = request.targetType();
        ReportReason reason = request.reason();

        if (targetType == ReportTargetType.ACCOUNT) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Account reports must use the suspension appeal flow.");
        }
        if (reason == ReportReason.SUSPENSION_APPEAL) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Suspension appeals must use the suspension appeal flow.");
        }

        String targetId = normalizeTargetId(request.targetId());
        TargetContext context = validateTargetAndBuildContext(targetType, targetId, reporter.getId());

        if (reportRepository.existsByReporterIdAndTargetTypeAndTargetIdAndStatus(
                reporter.getId(),
                targetType,
                targetId,
                ReportStatus.PENDING
        )) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "You already have a pending report for this target.");
        }

        Report report = Report.builder()
                .reporterId(reporter.getId())
                .reporterEmail(reporter.getEmail())
                .reporterUsername(reporter.getUsername())
                .targetType(targetType)
                .targetId(targetId)
                .reason(reason)
                .description(request.description().trim())
                .status(ReportStatus.PENDING)
                .reporterBookedTarget(context.reporterBookedTarget())
                .reporterCompletedTarget(context.reporterCompletedTarget())
                .reporterHadChatWithTarget(context.reporterHadChatWithTarget())
                .reporterBelongsToSession(context.reporterBelongsToSession())
                .createdAt(Instant.now())
                .build();

        return toResponse(reportRepository.save(report));
    }

    public ReportResponse createSuspensionAppeal(User suspendedUser, String description) {
        if (suspendedUser == null || isBlank(suspendedUser.getId())) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Suspended account not found");
        }
        if (!suspendedUser.isSuspended()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "This account is not suspended.");
        }
        if (isBlank(description)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Description is required");
        }

        String targetId = suspendedUser.getId();
        if (reportRepository.existsByReporterIdAndTargetTypeAndTargetIdAndReasonAndStatus(
                suspendedUser.getId(),
                ReportTargetType.ACCOUNT,
                targetId,
                ReportReason.SUSPENSION_APPEAL,
                ReportStatus.PENDING
        )) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "You already have a pending suspension appeal.");
        }

        Report report = Report.builder()
                .reporterId(suspendedUser.getId())
                .reporterEmail(suspendedUser.getEmail())
                .reporterUsername(suspendedUser.getUsername())
                .targetType(ReportTargetType.ACCOUNT)
                .targetId(targetId)
                .reason(ReportReason.SUSPENSION_APPEAL)
                .description(description.trim())
                .status(ReportStatus.PENDING)
                .reporterBookedTarget(false)
                .reporterCompletedTarget(false)
                .reporterHadChatWithTarget(false)
                .reporterBelongsToSession(false)
                .createdAt(Instant.now())
                .build();

        return toResponse(reportRepository.save(report));
    }

    private TargetContext validateTargetAndBuildContext(ReportTargetType targetType, String targetId, String reporterId) {
        return switch (targetType) {
            case GUIDE -> guideContext(targetId, reporterId);
            case ACTIVITY -> activityContext(targetId, reporterId);
            case USER -> userContext(targetId, reporterId);
            case SESSION -> sessionContext(targetId, reporterId);
            case ACCOUNT -> throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Account reports must use the suspension appeal flow."
            );
        };
    }

    private TargetContext guideContext(String guideId, String reporterId) {
        User guide = userRepository.findById(guideId)
                .filter(user -> user.getRole() == Role.GUIDE)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Guide not found"));

        List<String> sessionIds = activitySessionRepository.findByGuideId(guide.getId())
                .stream()
                .map(ActivitySession::getId)
                .filter(Objects::nonNull)
                .toList();

        BookingFlags bookingFlags = bookingFlagsForSessions(reporterId, sessionIds);
        return new TargetContext(
                bookingFlags.booked(),
                bookingFlags.completed(),
                hadChatWithUser(reporterId, guide.getId()),
                false
        );
    }

    private TargetContext activityContext(String activityId, String reporterId) {
        ActivityTemplate template = activityTemplateRepository.findById(activityId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Activity not found"));

        List<String> sessionIds = activitySessionRepository.findByTemplateId(activityId)
                .stream()
                .map(ActivitySession::getId)
                .filter(Objects::nonNull)
                .toList();

        BookingFlags bookingFlags = bookingFlagsForSessions(reporterId, sessionIds);
        return new TargetContext(
                bookingFlags.booked(),
                bookingFlags.completed(),
                template.getGuideId() != null && hadChatWithUser(reporterId, template.getGuideId()),
                false
        );
    }

    private TargetContext userContext(String userId, String reporterId) {
        User target = userRepository.findById(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));

        if (target.getRole() == Role.GUIDE) {
            return guideContext(target.getId(), reporterId);
        }

        return new TargetContext(
                false,
                false,
                hadChatWithUser(reporterId, target.getId()),
                false
        );
    }

    private TargetContext sessionContext(String sessionId, String reporterId) {
        ActivitySession session = activitySessionRepository.findById(sessionId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Session not found"));

        List<Booking> sessionBookings = bookingRepository.findBySessionIdOrderByCreatedAtAsc(sessionId);
        boolean reporterIsGuide = reporterId.equals(session.getGuideId());
        boolean reporterHasBooking = sessionBookings.stream().anyMatch(booking -> reporterId.equals(booking.getUserId()));
        boolean reporterBelongsToSession = reporterIsGuide || reporterHasBooking;

        if (!reporterBelongsToSession) {
            throw new ResponseStatusException(
                    HttpStatus.FORBIDDEN,
                    "Session reports are only allowed for users involved in the session."
            );
        }

        boolean reporterCompletedSession = sessionBookings.stream()
                .anyMatch(booking -> reporterId.equals(booking.getUserId()) && booking.getStatus() == BookingStatus.COMPLETED);

        return new TargetContext(
                reporterHasBooking,
                reporterCompletedSession,
                hadChatInSession(reporterId, session),
                true
        );
    }

    private BookingFlags bookingFlagsForSessions(String reporterId, Collection<String> sessionIds) {
        if (sessionIds == null || sessionIds.isEmpty()) {
            return new BookingFlags(false, false);
        }

        List<Booking> bookings = bookingRepository.findBySessionIdIn(sessionIds);
        boolean booked = false;
        boolean completed = false;

        for (Booking booking : bookings) {
            if (!reporterId.equals(booking.getUserId())) {
                continue;
            }
            booked = true;
            if (booking.getStatus() == BookingStatus.COMPLETED) {
                completed = true;
            }
            if (booked && completed) {
                break;
            }
        }

        return new BookingFlags(booked, completed);
    }

    private boolean hadChatInSession(String reporterId, ActivitySession session) {
        if (session == null || session.getId() == null) {
            return false;
        }

        return chatRoomRepository.findBySessionId(session.getId())
                .map(room -> reporterId.equals(room.getGuideId())
                        || contains(room.getParticipantUserIds(), reporterId))
                .orElse(false);
    }

    private boolean hadChatWithUser(String reporterId, String targetUserId) {
        if (isBlank(reporterId) || isBlank(targetUserId) || reporterId.equals(targetUserId)) {
            return false;
        }

        boolean targetGuideRoomsIncludeReporter = chatRoomRepository.findByGuideId(targetUserId)
                .stream()
                .anyMatch(room -> contains(room.getParticipantUserIds(), reporterId));
        if (targetGuideRoomsIncludeReporter) {
            return true;
        }

        boolean reporterGuideRoomsIncludeTarget = chatRoomRepository.findByGuideId(reporterId)
                .stream()
                .anyMatch(room -> contains(room.getParticipantUserIds(), targetUserId));
        if (reporterGuideRoomsIncludeTarget) {
            return true;
        }

        return chatRoomRepository.findByParticipantUserIdsContaining(reporterId)
                .stream()
                .anyMatch(room -> targetUserId.equals(room.getGuideId())
                        || contains(room.getParticipantUserIds(), targetUserId));
    }

    private User requireCurrentUser(Authentication authentication) {
        if (authentication == null || !authentication.isAuthenticated()) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Authentication required");
        }

        Object principal = authentication.getPrincipal();
        if (principal instanceof AuthenticatedUser authenticatedUser) {
            return userRepository.findById(authenticatedUser.getId())
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Authenticated user not found"));
        }

        String email = authentication.getName();
        if (isBlank(email)) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Authenticated user not found");
        }

        return userRepository.findByEmail(email)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Authenticated user not found"));
    }

    private ReportResponse toResponse(Report report) {
        return new ReportResponse(
                report.getId(),
                report.getReporterId(),
                report.getReporterEmail(),
                report.getReporterUsername(),
                report.getTargetType(),
                report.getTargetId(),
                report.getReason(),
                report.getDescription(),
                report.getStatus(),
                report.isReporterBookedTarget(),
                report.isReporterCompletedTarget(),
                report.isReporterHadChatWithTarget(),
                report.isReporterBelongsToSession(),
                report.getAdminNote(),
                report.getReviewedByAdminId(),
                report.getCreatedAt(),
                report.getReviewedAt()
        );
    }

    private static String normalizeTargetId(String value) {
        if (value == null || value.trim().isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Target id is required");
        }
        return value.trim();
    }

    private static boolean contains(Collection<String> values, String value) {
        return values != null && values.contains(value);
    }

    private static boolean isBlank(String value) {
        return value == null || value.trim().isEmpty();
    }

    private record TargetContext(
            boolean reporterBookedTarget,
            boolean reporterCompletedTarget,
            boolean reporterHadChatWithTarget,
            boolean reporterBelongsToSession
    ) {
    }

    private record BookingFlags(boolean booked, boolean completed) {
    }
}

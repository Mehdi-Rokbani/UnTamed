package com.untamed.untamedbackend.admin;

import com.untamed.untamedbackend.dto.PaginatedResponse;
import com.untamed.untamedbackend.integrations.email.EmailSender;
import com.untamed.untamedbackend.model.ActivitySession;
import com.untamed.untamedbackend.model.ActivityTemplate;
import com.untamed.untamedbackend.model.Role;
import com.untamed.untamedbackend.model.User;
import com.untamed.untamedbackend.notification.NotificationService;
import com.untamed.untamedbackend.notification.NotificationSeverity;
import com.untamed.untamedbackend.notification.NotificationType;
import com.untamed.untamedbackend.report.Report;
import com.untamed.untamedbackend.report.ReportReason;
import com.untamed.untamedbackend.report.ReportRepository;
import com.untamed.untamedbackend.report.ReportStatus;
import com.untamed.untamedbackend.report.ReportTargetType;
import com.untamed.untamedbackend.repository.ActivitySessionRepository;
import com.untamed.untamedbackend.repository.ActivityTemplateRepository;
import com.untamed.untamedbackend.repository.UserRepository;
import com.untamed.untamedbackend.security.AuthenticatedUser;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

@Service
@RequiredArgsConstructor
public class AdminReportService {

    private final ReportRepository reportRepository;
    private final UserRepository userRepository;
    private final ActivityTemplateRepository activityTemplateRepository;
    private final ActivitySessionRepository activitySessionRepository;
    private final AdminAuditLogService auditLogService;
    private final NotificationService notificationService;
    private final EmailSender emailSender;
    private final MongoTemplate mongoTemplate;

    public PaginatedResponse<AdminReportResponse> listReports(
            int page,
            int size,
            String status,
            String targetType,
            String reason,
            String sort
    ) {
        int safePage = Math.max(0, page);
        int safeSize = Math.max(1, Math.min(100, size));
        List<Criteria> criteria = new ArrayList<>();

        Criteria statusCriteria = reportStatusCriteria(status);
        if (statusCriteria != null) criteria.add(statusCriteria);

        Criteria targetTypeCriteria = reportTargetTypeCriteria(targetType);
        if (targetTypeCriteria != null) criteria.add(targetTypeCriteria);

        Criteria reasonCriteria = reportReasonCriteria(reason);
        if (reasonCriteria != null) criteria.add(reasonCriteria);

        Query baseQuery = new Query();
        if (!criteria.isEmpty()) {
            baseQuery.addCriteria(new Criteria().andOperator(criteria.toArray(Criteria[]::new)));
        }

        long total = mongoTemplate.count(baseQuery, Report.class);
        List<AdminReportResponse> content = mongoTemplate.find(
                        Query.of(baseQuery)
                                .with(PageRequest.of(safePage, safeSize))
                                .with(resolveSort(sort)),
                        Report.class
                )
                .stream()
                .map(this::toResponse)
                .toList();

        return PaginatedResponse.of(content, safePage, safeSize, total);
    }

    public AdminReportResponse getReport(String reportId) {
        return toResponse(requireReport(reportId));
    }

    public AdminReportResponse resolveReport(String reportId, ReviewReportRequest request, Authentication authentication) {
        return reviewReport(reportId, request, authentication, ReportStatus.RESOLVED, AdminAuditAction.REPORT_RESOLVED);
    }

    public AdminReportResponse rejectReport(String reportId, ReviewReportRequest request, Authentication authentication) {
        return reviewReport(reportId, request, authentication, ReportStatus.REJECTED, AdminAuditAction.REPORT_REJECTED);
    }

    private AdminReportResponse reviewReport(
            String reportId,
            ReviewReportRequest request,
            Authentication authentication,
            ReportStatus nextStatus,
            AdminAuditAction auditAction
    ) {
        User admin = requireAdmin(authentication);
        Report report = requireReport(reportId);

        if (report.getStatus() != ReportStatus.PENDING) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Only pending reports can be reviewed.");
        }

        String note = normalizeNote(request == null ? null : request.adminNote());
        Instant now = Instant.now();
        report.setStatus(nextStatus);
        report.setAdminNote(note);
        report.setReviewedByAdminId(admin.getId());
        report.setReviewedAt(now);

        Report saved = reportRepository.save(report);
        String notificationDetails = notifyReporterAfterReview(saved, nextStatus);
        String emailDetails = sendSuspensionAppealEmailIfNeeded(saved, nextStatus);

        auditLogService.logAction(
                admin,
                auditAction,
                AdminAuditTargetType.REPORT,
                saved.getId(),
                buildReportLabel(saved),
                note,
                "reportTargetType=" + saved.getTargetType()
                        + ", reportTargetId=" + saved.getTargetId()
                        + ", reportReason=" + saved.getReason()
                        + ", reporterId=" + saved.getReporterId()
                        + ", " + notificationDetails
                        + ", " + emailDetails
        );

        return toResponse(saved);
    }

    private Report requireReport(String reportId) {
        String cleanId = trimToNull(reportId);
        if (cleanId == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Report id is required");
        }
        return reportRepository.findById(cleanId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Report not found"));
    }

    private User requireAdmin(Authentication authentication) {
        if (authentication == null || !authentication.isAuthenticated()) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Authentication required");
        }

        Object principal = authentication.getPrincipal();
        if (principal instanceof AuthenticatedUser authenticatedUser) {
            User admin = userRepository.findById(authenticatedUser.getId())
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Admin user not found"));
            if (admin.getRole() != Role.ADMIN) {
                throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Admin role required");
            }
            return admin;
        }

        throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Authentication required");
    }

    private AdminReportResponse toResponse(Report report) {
        return new AdminReportResponse(
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
                report.getReviewedAt(),
                targetSummary(report)
        );
    }

    private AdminReportTargetSummary targetSummary(Report report) {
        if (report.getTargetType() == null || report.getTargetId() == null) {
            return null;
        }

        return switch (report.getTargetType()) {
            case USER, GUIDE, ACCOUNT -> userTargetSummary(report.getTargetId());
            case ACTIVITY -> activityTargetSummary(report.getTargetId());
            case SESSION -> sessionTargetSummary(report.getTargetId());
        };
    }

    private AdminReportTargetSummary userTargetSummary(String userId) {
        return userRepository.findById(userId)
                .map(user -> new AdminReportTargetSummary(
                        user.getUsername(),
                        user.getUsername(),
                        user.getEmail(),
                        user.getRole() == null ? null : user.getRole().name(),
                        user.isSuspended(),
                        null,
                        null,
                        null,
                        null,
                        null,
                        null
                ))
                .orElse(null);
    }

    private AdminReportTargetSummary activityTargetSummary(String activityId) {
        return activityTemplateRepository.findById(activityId)
                .map(activity -> new AdminReportTargetSummary(
                        activity.getTitle(),
                        null,
                        null,
                        null,
                        null,
                        activity.getTitle(),
                        activity.isArchived() ? "DISABLED" : "PUBLISHED",
                        null,
                        null,
                        null,
                        null
                ))
                .orElse(null);
    }

    private AdminReportTargetSummary sessionTargetSummary(String sessionId) {
        ActivitySession session = activitySessionRepository.findById(sessionId).orElse(null);
        if (session == null) {
            return null;
        }

        ActivityTemplate template = activityTemplateRepository.findById(session.getTemplateId()).orElse(null);
        String label = template == null ? session.getId() : template.getTitle();

        return new AdminReportTargetSummary(
                label,
                null,
                null,
                null,
                null,
                template == null ? null : template.getTitle(),
                null,
                session.getTemplateId(),
                session.getGuideId(),
                session.getStatus() == null ? null : session.getStatus().name(),
                session.getStartAt()
        );
    }

    private Criteria reportStatusCriteria(String status) {
        String value = trimToNull(status);
        if (value == null || "ALL".equalsIgnoreCase(value)) return null;
        try {
            return Criteria.where("status").is(ReportStatus.valueOf(value.toUpperCase()));
        } catch (IllegalArgumentException e) {
            return Criteria.where("_id").in(List.of());
        }
    }

    private Criteria reportTargetTypeCriteria(String targetType) {
        String value = trimToNull(targetType);
        if (value == null || "ALL".equalsIgnoreCase(value)) return null;
        try {
            return Criteria.where("targetType").is(ReportTargetType.valueOf(value.toUpperCase()));
        } catch (IllegalArgumentException e) {
            return Criteria.where("_id").in(List.of());
        }
    }

    private Criteria reportReasonCriteria(String reason) {
        String value = trimToNull(reason);
        if (value == null || "ALL".equalsIgnoreCase(value)) return null;
        try {
            return Criteria.where("reason").is(ReportReason.valueOf(value.toUpperCase()));
        } catch (IllegalArgumentException e) {
            return Criteria.where("_id").in(List.of());
        }
    }

    private Sort resolveSort(String sort) {
        String value = trimToNull(sort);
        if ("createdAt,asc".equalsIgnoreCase(value) || "oldest".equalsIgnoreCase(value)) {
            return Sort.by(Sort.Direction.ASC, "createdAt");
        }
        return Sort.by(Sort.Direction.DESC, "createdAt");
    }

    private String buildReportLabel(Report report) {
        return (report.getTargetType() == null ? "Report" : report.getTargetType().name())
                + " report - "
                + report.getId();
    }

    private String normalizeNote(String value) {
        String note = trimToNull(value);
        return note == null ? "Reviewed by admin." : note;
    }

    private String notifyReporterAfterReview(Report report, ReportStatus status) {
        if (report == null || trimToNull(report.getReporterId()) == null) {
            return "notificationSent=false, notificationReason=missingReporter";
        }

        if (report.getReason() == ReportReason.SUSPENSION_APPEAL
                || report.getTargetType() == ReportTargetType.ACCOUNT) {
            return notifySuspensionAppealReporter(report, status);
        }

        NotificationSeverity severity = status == ReportStatus.RESOLVED
                ? NotificationSeverity.SUCCESS
                : NotificationSeverity.INFO;
        String title = status == ReportStatus.RESOLVED
                ? "Your report was reviewed"
                : "Your report was closed";
        String message = status == ReportStatus.RESOLVED
                ? "Thanks for helping keep UnTamed safe. Our team reviewed your report and handled it according to our policies."
                : "Thanks for your report. Our team reviewed it and closed it based on the available information.";

        return sendReportNotification(
                report,
                NotificationType.REPORT_REVIEWED,
                title,
                message,
                severity,
                "/notifications"
        );
    }

    private String notifySuspensionAppealReporter(Report report, ReportStatus status) {
        User account = userRepository.findById(report.getReporterId()).orElse(null);
        if (account == null) {
            return "notificationSent=false, notificationReason=appealUserMissing";
        }

        if (account.isSuspended()) {
            return "notificationSent=false, notificationReason=appealUserStillSuspended";
        }

        NotificationSeverity severity = status == ReportStatus.RESOLVED
                ? NotificationSeverity.SUCCESS
                : NotificationSeverity.INFO;
        String title = status == ReportStatus.RESOLVED
                ? "Your account review is complete"
                : "Your suspension appeal was reviewed";
        String message = status == ReportStatus.RESOLVED
                ? "Your appeal was reviewed and your account access is available again."
                : "Your suspension appeal was reviewed. Check your account status or contact support if you need more help.";

        return sendReportNotification(
                report,
                NotificationType.SUSPENSION_APPEAL_REVIEWED,
                title,
                message,
                severity,
                "/home"
        );
    }

    private String sendReportNotification(
            Report report,
            NotificationType type,
            String title,
            String message,
            NotificationSeverity severity,
            String actionUrl
    ) {
        try {
            notificationService.createAndSend(
                    report.getReporterId(),
                    type,
                    title,
                    message,
                    severity,
                    actionUrl,
                    "REPORT",
                    report.getId()
            );
            return "notificationSent=true";
        } catch (RuntimeException e) {
            return "notificationSent=false, notificationReason=" + e.getClass().getSimpleName();
        }
    }

    private String sendSuspensionAppealEmailIfNeeded(Report report, ReportStatus status) {
        if (report == null
                || (report.getReason() != ReportReason.SUSPENSION_APPEAL
                && report.getTargetType() != ReportTargetType.ACCOUNT)) {
            return "emailSent=false, emailReason=notSuspensionAppeal";
        }

        User account = trimToNull(report.getReporterId()) == null
                ? null
                : userRepository.findById(report.getReporterId()).orElse(null);
        String email = account == null ? report.getReporterEmail() : account.getEmail();
        if (trimToNull(email) == null) {
            return "emailSent=false, emailReason=missingEmail";
        }

        boolean accessRestored = status == ReportStatus.RESOLVED && account != null && !account.isSuspended();
        try {
            emailSender.send(
                    email,
                    suspensionAppealEmailSubject(accessRestored),
                    suspensionAppealEmailBody(account, accessRestored)
            );
            return "emailSent=true";
        } catch (RuntimeException e) {
            return "emailSent=false, emailReason=" + e.getClass().getSimpleName();
        }
    }

    private String suspensionAppealEmailSubject(boolean accessRestored) {
        return accessRestored
                ? "Your UnTamed account access was restored"
                : "Your suspension appeal was reviewed";
    }

    private String suspensionAppealEmailBody(User account, boolean accessRestored) {
        String greetingName = account == null ? null : trimToNull(account.getUsername());
        String greeting = greetingName == null ? "Hello," : "Hello " + greetingName + ",";
        String decision = accessRestored
                ? "Your suspension appeal has been reviewed, and your UnTamed account access is available again."
                : "Your suspension appeal has been reviewed. Based on the information available, your account access may remain restricted.";

        return greeting + "\n\n"
                + decision + "\n\n"
                + "For privacy and safety reasons, moderation notes are not included in this email. "
                + "You can try signing in again to check your current account status.\n\n"
                + "Thank you,\n"
                + "The UnTamed Team";
    }

    private String trimToNull(String value) {
        if (value == null || value.isBlank()) return null;
        return value.trim();
    }
}

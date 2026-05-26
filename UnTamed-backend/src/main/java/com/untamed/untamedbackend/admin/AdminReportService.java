package com.untamed.untamedbackend.admin;

import com.untamed.untamedbackend.dto.PaginatedResponse;
import com.untamed.untamedbackend.model.ActivitySession;
import com.untamed.untamedbackend.model.ActivityTemplate;
import com.untamed.untamedbackend.model.Role;
import com.untamed.untamedbackend.model.User;
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

    private String trimToNull(String value) {
        if (value == null || value.isBlank()) return null;
        return value.trim();
    }
}

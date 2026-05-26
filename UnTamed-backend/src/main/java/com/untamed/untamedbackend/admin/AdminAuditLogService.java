package com.untamed.untamedbackend.admin;

import com.untamed.untamedbackend.dto.PaginatedResponse;
import com.untamed.untamedbackend.model.User;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.List;
import java.util.regex.Pattern;

@Service
public class AdminAuditLogService {

    private final AdminAuditLogRepository repository;
    private final MongoTemplate mongoTemplate;

    public AdminAuditLogService(AdminAuditLogRepository repository, MongoTemplate mongoTemplate) {
        this.repository = repository;
        this.mongoTemplate = mongoTemplate;
    }

    public AdminAuditLog logAction(
            User adminUser,
            AdminAuditAction action,
            AdminAuditTargetType targetType,
            String targetId,
            String targetLabel,
            String reason,
            String details
    ) {
        AdminAuditLog log = AdminAuditLog.builder()
                .adminId(adminUser == null ? null : adminUser.getId())
                .adminEmail(adminUser == null ? null : adminUser.getEmail())
                .action(action)
                .targetType(targetType)
                .targetId(targetId)
                .targetLabel(targetLabel)
                .reason(trimToNull(reason))
                .details(trimToNull(details))
                .createdAt(Instant.now())
                .build();

        return repository.save(log);
    }

    public PaginatedResponse<AdminAuditLogResponse> listLogsPage(
            int page,
            int size,
            String query,
            String action,
            String targetType,
            String adminId,
            String targetId,
            String fromDate,
            String toDate
    ) {
        int safePage = safePage(page);
        int safeSize = safeSize(size);
        List<Criteria> criteria = new ArrayList<>();
        String term = trimToNull(query);

        if (term != null) {
            Pattern pattern = containsPattern(term);
            criteria.add(new Criteria().orOperator(
                    Criteria.where("adminEmail").regex(pattern),
                    Criteria.where("targetLabel").regex(pattern),
                    Criteria.where("reason").regex(pattern),
                    Criteria.where("details").regex(pattern)
            ));
        }

        Criteria actionCriteria = auditActionCriteria(action);
        if (actionCriteria != null) {
            criteria.add(actionCriteria);
        }

        Criteria targetTypeCriteria = auditTargetTypeCriteria(targetType);
        if (targetTypeCriteria != null) {
            criteria.add(targetTypeCriteria);
        }

        String cleanAdminId = trimToNull(adminId);
        if (cleanAdminId != null) {
            criteria.add(Criteria.where("adminId").is(cleanAdminId));
        }

        String cleanTargetId = trimToNull(targetId);
        if (cleanTargetId != null) {
            criteria.add(Criteria.where("targetId").is(cleanTargetId));
        }

        Criteria dateCriteria = createdAtCriteria(fromDate, toDate);
        if (dateCriteria != null) {
            criteria.add(dateCriteria);
        }

        Query baseQuery = queryFrom(criteria);
        long total = mongoTemplate.count(baseQuery, AdminAuditLog.class);
        List<AdminAuditLogResponse> content = mongoTemplate.find(
                        Query.of(baseQuery)
                                .with(PageRequest.of(safePage, safeSize))
                                .with(Sort.by(Sort.Direction.DESC, "createdAt")),
                        AdminAuditLog.class
                )
                .stream()
                .map(this::toResponse)
                .toList();

        return PaginatedResponse.of(content, safePage, safeSize, total);
    }

    public List<AdminOverviewResponse.RecentAuditLog> listRecentOverviewLogs(int limit) {
        return repository.findAllByOrderByCreatedAtDesc()
                .stream()
                .limit(Math.max(0, limit))
                .map(log -> new AdminOverviewResponse.RecentAuditLog(
                        log.getId(),
                        log.getAdminEmail(),
                        log.getAction() == null ? null : log.getAction().name(),
                        log.getTargetLabel(),
                        log.getCreatedAt()
                ))
                .toList();
    }

    private AdminAuditLogResponse toResponse(AdminAuditLog log) {
        return new AdminAuditLogResponse(
                log.getId(),
                log.getAdminId(),
                log.getAdminEmail(),
                log.getAction() == null ? null : log.getAction().name(),
                log.getTargetType() == null ? null : log.getTargetType().name(),
                log.getTargetId(),
                log.getTargetLabel(),
                log.getReason(),
                log.getDetails(),
                log.getCreatedAt()
        );
    }

    private String trimToNull(String value) {
        if (value == null || value.isBlank()) return null;
        return value.trim();
    }

    private Query queryFrom(List<Criteria> criteria) {
        Query query = new Query();
        if (!criteria.isEmpty()) {
            query.addCriteria(new Criteria().andOperator(criteria.toArray(Criteria[]::new)));
        }
        return query;
    }

    private Pattern containsPattern(String value) {
        return Pattern.compile(Pattern.quote(value.trim()), Pattern.CASE_INSENSITIVE);
    }

    private int safePage(int page) {
        return Math.max(0, page);
    }

    private int safeSize(int size) {
        return Math.max(1, Math.min(100, size));
    }

    private Criteria auditActionCriteria(String action) {
        String value = trimToNull(action);
        if (value == null || "ALL".equalsIgnoreCase(value)) return null;

        try {
            return Criteria.where("action").is(AdminAuditAction.valueOf(value.toUpperCase()));
        } catch (IllegalArgumentException e) {
            return Criteria.where("_id").in(List.of());
        }
    }

    private Criteria auditTargetTypeCriteria(String targetType) {
        String value = trimToNull(targetType);
        if (value == null || "ALL".equalsIgnoreCase(value)) return null;

        try {
            return Criteria.where("targetType").is(AdminAuditTargetType.valueOf(value.toUpperCase()));
        } catch (IllegalArgumentException e) {
            return Criteria.where("_id").in(List.of());
        }
    }

    private Criteria createdAtCriteria(String fromDate, String toDate) {
        Instant from = parseStartInstant(fromDate);
        Instant to = parseEndInstant(toDate);

        if (from == null && to == null) return null;

        Criteria criteria = Criteria.where("createdAt");
        if (from != null) {
            criteria = criteria.gte(from);
        }
        if (to != null) {
            criteria = criteria.lte(to);
        }
        return criteria;
    }

    private Instant parseStartInstant(String value) {
        String cleaned = trimToNull(value);
        if (cleaned == null) return null;

        try {
            return Instant.parse(cleaned);
        } catch (DateTimeParseException ignored) {
            try {
                return LocalDate.parse(cleaned).atStartOfDay().toInstant(ZoneOffset.UTC);
            } catch (DateTimeParseException e) {
                return null;
            }
        }
    }

    private Instant parseEndInstant(String value) {
        String cleaned = trimToNull(value);
        if (cleaned == null) return null;

        try {
            return Instant.parse(cleaned);
        } catch (DateTimeParseException ignored) {
            try {
                return LocalDate.parse(cleaned).plusDays(1).atStartOfDay().minusNanos(1).toInstant(ZoneOffset.UTC);
            } catch (DateTimeParseException e) {
                return null;
            }
        }
    }
}

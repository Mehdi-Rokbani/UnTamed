package com.untamed.untamedbackend.report;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.repository.MongoRepository;

public interface ReportRepository extends MongoRepository<Report, String> {
    boolean existsByReporterIdAndTargetTypeAndTargetIdAndStatus(
            String reporterId,
            ReportTargetType targetType,
            String targetId,
            ReportStatus status
    );

    boolean existsByReporterIdAndTargetTypeAndTargetIdAndReasonAndStatus(
            String reporterId,
            ReportTargetType targetType,
            String targetId,
            ReportReason reason,
            ReportStatus status
    );

    Page<Report> findByStatus(ReportStatus status, Pageable pageable);

    Page<Report> findByTargetType(ReportTargetType targetType, Pageable pageable);

    Page<Report> findByStatusAndTargetType(ReportStatus status, ReportTargetType targetType, Pageable pageable);
}

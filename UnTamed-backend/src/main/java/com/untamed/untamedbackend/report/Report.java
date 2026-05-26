package com.untamed.untamedbackend.report;

import jakarta.validation.constraints.Size;
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

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@Document(collection = "reports")
@CompoundIndexes({
        @CompoundIndex(name = "idx_reports_target_status", def = "{'targetType': 1, 'targetId': 1, 'status': 1}"),
        @CompoundIndex(name = "idx_reports_reporter_target_status", def = "{'reporterId': 1, 'targetType': 1, 'targetId': 1, 'status': 1}"),
        @CompoundIndex(name = "idx_reports_status_created", def = "{'status': 1, 'createdAt': -1}")
})
public class Report {

    @Id
    private String id;

    @Indexed
    private String reporterId;

    private String reporterEmail;
    private String reporterUsername;

    @Indexed
    private ReportTargetType targetType;

    @Indexed
    private String targetId;

    @Indexed
    private ReportReason reason;

    @Size(max = 2000)
    private String description;

    @Indexed
    private ReportStatus status;

    private boolean reporterBookedTarget;
    private boolean reporterCompletedTarget;
    private boolean reporterHadChatWithTarget;
    private boolean reporterBelongsToSession;

    private String adminNote;
    private String reviewedByAdminId;

    @Indexed
    private Instant createdAt;

    private Instant reviewedAt;
}

package com.untamed.untamedbackend.admin;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@Document(collection = "admin_audit_logs")
public class AdminAuditLog {

    @Id
    private String id;

    @Indexed
    private String adminId;

    @Indexed
    private String adminEmail;

    @Indexed
    private AdminAuditAction action;

    @Indexed
    private AdminAuditTargetType targetType;

    @Indexed
    private String targetId;

    private String targetLabel;
    private String reason;
    private String details;

    @Indexed
    private Instant createdAt;
}

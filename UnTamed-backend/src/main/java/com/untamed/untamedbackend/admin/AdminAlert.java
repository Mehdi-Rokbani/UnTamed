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
@Document(collection = "admin_alerts")
public class AdminAlert {

    @Id
    private String id;

    @Indexed
    private String type;

    @Indexed
    private String severity;

    private String title;
    private String description;

    @Indexed
    private String entityType;

    @Indexed
    private String entityId;

    private String route;

    @Indexed
    private AdminAlertStatus status;

    @Indexed
    private Instant createdAt;

    private Instant updatedAt;
    private Instant acknowledgedAt;
    private String acknowledgedByAdminId;
    private String acknowledgedByAdminEmail;
    private Instant resolvedAt;
    private String resolvedByAdminId;
    private String resolvedByAdminEmail;
}

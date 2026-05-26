package com.untamed.untamedbackend.admin;

import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;

public interface AdminAuditLogRepository extends MongoRepository<AdminAuditLog, String> {
    List<AdminAuditLog> findAllByOrderByCreatedAtDesc();
}

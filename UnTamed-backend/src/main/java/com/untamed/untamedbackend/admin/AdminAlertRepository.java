package com.untamed.untamedbackend.admin;

import org.springframework.data.mongodb.repository.MongoRepository;

public interface AdminAlertRepository extends MongoRepository<AdminAlert, String> {
}

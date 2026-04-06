package com.untamed.untamedbackend.repository;

import com.untamed.untamedbackend.model.UserInsight;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.Optional;

public interface UserInsightRepository extends MongoRepository<UserInsight, String> {
    Optional<UserInsight> findByUserId(String userId);
}
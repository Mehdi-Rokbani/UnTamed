package com.untamed.untamedbackend.repository;

import com.untamed.untamedbackend.model.Activity;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.Optional;

public interface ActivityRepository extends MongoRepository<Activity, String> {
    Optional<Activity> findByIdAndGuideId(String id, String guideId);
}

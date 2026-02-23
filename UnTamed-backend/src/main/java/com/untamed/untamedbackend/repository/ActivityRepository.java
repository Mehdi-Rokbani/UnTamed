// src/main/java/com/untamed/untamedbackend/repository/ActivityRepository.java
package com.untamed.untamedbackend.repository;

import com.untamed.untamedbackend.model.Activity;
import com.untamed.untamedbackend.model.ActivityStatus;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;
import java.util.Optional;

public interface ActivityRepository extends MongoRepository<Activity, String> {

    List<Activity> findByStatus(ActivityStatus status);

    List<Activity> findByGuideId(String guideId);

    Optional<Activity> findByIdAndGuideId(String id, String guideId);

}

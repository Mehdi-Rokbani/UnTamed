package com.untamed.untamedbackend.repository;

import com.untamed.untamedbackend.model.ActivityTemplate;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;
import java.util.Optional;

public interface ActivityTemplateRepository extends MongoRepository<ActivityTemplate, String> {

    List<ActivityTemplate> findByGuideId(String guideId);

    Optional<ActivityTemplate> findByIdAndGuideId(String id, String guideId);

    boolean existsByIdAndGuideId(String id, String guideId);
}
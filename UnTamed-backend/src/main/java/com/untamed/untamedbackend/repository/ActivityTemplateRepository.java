package com.untamed.untamedbackend.repository;

import com.untamed.untamedbackend.model.ActivityTemplate;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;
import java.util.Optional;

public interface ActivityTemplateRepository extends MongoRepository<ActivityTemplate, String> {

    List<ActivityTemplate> findByGuideId(String guideId);

    Page<ActivityTemplate> findByGuideId(String guideId, Pageable pageable);

    Page<ActivityTemplate> findByArchivedFalse(Pageable pageable);

    Optional<ActivityTemplate> findByIdAndGuideId(String id, String guideId);

    boolean existsByIdAndGuideId(String id, String guideId);
    List<ActivityTemplate> findByGuideIdAndArchivedFalse(String guideId);

    Page<ActivityTemplate> findByGuideIdAndArchivedFalse(String guideId, Pageable pageable);

    Optional<ActivityTemplate> findByIdAndGuideIdAndArchivedFalse(String id, String guideId);

    boolean existsByIdAndGuideIdAndArchivedFalse(String id, String guideId);

    long countByGuideIdAndArchivedFalse(String guideId);

    long countByArchivedFalse();
}

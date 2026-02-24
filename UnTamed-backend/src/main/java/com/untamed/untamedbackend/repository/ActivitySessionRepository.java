package com.untamed.untamedbackend.repository;

import com.untamed.untamedbackend.model.ActivitySession;
import com.untamed.untamedbackend.model.ActivityStatus;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

public interface ActivitySessionRepository extends MongoRepository<ActivitySession, String> {

    // sessions for a given template (many dates)
    List<ActivitySession> findByTemplateId(String templateId);

    // guide dashboard (all sessions created by this guide)
    List<ActivitySession> findByGuideId(String guideId);

    // ownership check
    Optional<ActivitySession> findByIdAndGuideId(String id, String guideId);

    // filters
    List<ActivitySession> findByStatus(ActivityStatus status);

    List<ActivitySession> findByStatusAndDateAfter(ActivityStatus status, Instant date);

    // for "block delete template if sessions exist"
    boolean existsByTemplateId(String templateId);

    long countByTemplateId(String templateId);

    Optional<ActivitySession> findFirstByTemplateIdAndStatusAndDateAfterOrderByDateAsc(
            String templateId,
            ActivityStatus status,
            Instant now
    );

    List<ActivitySession> findByTemplateIdAndStatusAndDateAfterOrderByDateAsc(
            String templateId,
            ActivityStatus status,
            Instant now
    );
}
package com.untamed.untamedbackend.repository;

import com.untamed.untamedbackend.model.ActivitySession;
import com.untamed.untamedbackend.model.ActivityStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

public interface ActivitySessionRepository extends MongoRepository<ActivitySession, String> {

    // sessions for a given template
    List<ActivitySession> findByTemplateId(String templateId);

    // guide dashboard
    List<ActivitySession> findByGuideId(String guideId);

    Page<ActivitySession> findByGuideId(String guideId, Pageable pageable);

    Page<ActivitySession> findByTemplateIdAndGuideId(String templateId, String guideId, Pageable pageable);

    List<ActivitySession> findByTemplateIdAndGuideIdOrderByStartAtAsc(String templateId, String guideId);

    // ownership check
    Optional<ActivitySession> findByIdAndGuideId(String id, String guideId);

    // public listing
    List<ActivitySession> findByStatus(ActivityStatus status);

    // for "block delete template if sessions exist"
    boolean existsByTemplateId(String templateId);

    long countByTemplateId(String templateId);
    long countByTemplateIdAndStatus(String templateId, ActivityStatus status);

    Optional<ActivitySession> findFirstByTemplateIdAndStatusAndStartAtAfterOrderByStartAtAsc(
            String templateId,
            ActivityStatus status,
            Instant now
    );

    List<ActivitySession> findByTemplateIdAndStatusAndStartAtAfterOrderByStartAtAsc(
            String templateId,
            ActivityStatus status,
            Instant now
    );

    List<ActivitySession> findByStatusAndStartAtBetween(ActivityStatus status, Instant from, Instant to);

    List<ActivitySession> findByStatusAndStartAtAfter(ActivityStatus status, Instant from);

    List<ActivitySession> findByStatusAndStartAtBefore(ActivityStatus status, Instant to);

    List<ActivitySession> findByTemplateIdOrderByStartAtAsc(String templateId);
    List<ActivitySession> findByGuideIdAndStartAtBeforeOrderByStartAtDesc(String guideId, Instant now);

    List<ActivitySession> findByGuideIdAndStartAtAfterOrderByStartAtAsc(String guideId, Instant now);

    List<ActivitySession> findByGuideIdAndStatusOrderByStartAtDesc(String guideId, ActivityStatus status);

    long countByGuideIdAndStatusAndStartAtAfter(String guideId, ActivityStatus status, Instant now);

    long countByStatus(ActivityStatus status);
}

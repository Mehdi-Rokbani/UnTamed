package com.untamed.untamedbackend.repository;

import com.untamed.untamedbackend.model.Review;
import com.untamed.untamedbackend.model.ReviewStatus;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;
import java.util.Optional;

public interface ReviewRepository extends MongoRepository<Review, String> {

    Optional<Review> findByReviewerIdAndActivityTemplateId(String reviewerId, String activityTemplateId);

    boolean existsByReviewerIdAndActivityTemplateId(String reviewerId, String activityTemplateId);

    List<Review> findByActivityTemplateIdAndStatusOrderByCreatedAtDesc(
            String activityTemplateId,
            ReviewStatus status
    );
    List<Review> findByReviewerIdOrderByCreatedAtDesc(String reviewerId);
}
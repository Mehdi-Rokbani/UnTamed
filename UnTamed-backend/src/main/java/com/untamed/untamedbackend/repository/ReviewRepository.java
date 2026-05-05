package com.untamed.untamedbackend.repository;

import com.untamed.untamedbackend.model.Review;
import com.untamed.untamedbackend.model.ReviewStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;
import java.util.Optional;

public interface ReviewRepository extends MongoRepository<Review, String> {

    boolean existsByReviewerIdAndActivityTemplateId(String reviewerId, String activityTemplateId);

    Optional<Review> findByReviewerIdAndActivityTemplateId(String reviewerId, String activityTemplateId);

    List<Review> findByReviewerIdAndBookingIdIn(String reviewerId, List<String> bookingIds);

    List<Review> findByReviewerIdAndActivityTemplateIdIn(String reviewerId, List<String> activityTemplateIds);

    List<Review> findByActivityTemplateIdAndStatusOrderByCreatedAtDesc(String activityTemplateId, ReviewStatus status);

    Page<Review> findByActivityTemplateIdAndStatus(String activityTemplateId, ReviewStatus status, Pageable pageable);

    List<Review> findByReviewerIdOrderByCreatedAtDesc(String reviewerId);

    Page<Review> findByReviewerId(String reviewerId, Pageable pageable);

    Page<Review> findByReviewerIdAndStatus(String reviewerId, ReviewStatus status, Pageable pageable);

    long countByReviewerId(String reviewerId);

    long countByReviewerIdAndStatus(String reviewerId, ReviewStatus status);
}

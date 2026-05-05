package com.untamed.untamedbackend.guidereview;

import com.untamed.untamedbackend.model.ReviewStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;
import java.util.Optional;

public interface GuideReviewRepository extends MongoRepository<GuideReview, String> {

    boolean existsByReviewerIdAndGuideIdAndBookingId(String reviewerId, String guideId, String bookingId);

    Optional<GuideReview> findByReviewerIdAndGuideIdAndBookingId(String reviewerId, String guideId, String bookingId);

    Page<GuideReview> findByGuideIdAndStatus(String guideId, ReviewStatus status, Pageable pageable);

    List<GuideReview> findByGuideIdAndStatus(String guideId, ReviewStatus status);
    long countByReviewerId(String reviewerId);

    long countByReviewerIdAndStatus(String reviewerId, ReviewStatus status);
}

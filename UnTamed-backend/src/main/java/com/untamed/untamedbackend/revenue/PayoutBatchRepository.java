package com.untamed.untamedbackend.revenue;

import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;

public interface PayoutBatchRepository extends MongoRepository<PayoutBatch, String> {

    List<PayoutBatch> findByGuideIdOrderByCreatedAtDesc(String guideId);

    List<PayoutBatch> findAllByOrderByCreatedAtDesc();
}

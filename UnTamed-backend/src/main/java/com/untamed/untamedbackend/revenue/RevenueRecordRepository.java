package com.untamed.untamedbackend.revenue;

import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface RevenueRecordRepository extends MongoRepository<RevenueRecord, String> {

    Optional<RevenueRecord> findByBookingId(String bookingId);

    List<RevenueRecord> findByGuideIdOrderByCreatedAtDesc(String guideId);

    List<RevenueRecord> findByStatus(RevenueRecordStatus status);

    List<RevenueRecord> findBySessionIdAndStatus(String sessionId, RevenueRecordStatus status);

    List<RevenueRecord> findByIdIn(Collection<String> ids);
}

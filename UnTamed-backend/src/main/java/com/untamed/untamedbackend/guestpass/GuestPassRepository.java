package com.untamed.untamedbackend.guestpass;

import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;
import java.util.Optional;

public interface GuestPassRepository extends MongoRepository<GuestPass, String> {

    Optional<GuestPass> findByToken(String token);

    List<GuestPass> findByBookingId(String bookingId);

    List<GuestPass> findBySessionId(String sessionId);

    List<GuestPass> findBySessionIdOrderByPassNumberAsc(String sessionId);

    List<GuestPass> findByGuideId(String guideId);

    List<GuestPass> findByGuideIdOrderByCreatedAtDesc(String guideId);

    boolean existsByBookingId(String bookingId);
}
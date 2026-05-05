package com.untamed.untamedbackend.guestpass;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;
import java.util.Collection;
import java.util.Optional;

public interface GuestPassRepository extends MongoRepository<GuestPass, String> {

    Optional<GuestPass> findByToken(String token);

    List<GuestPass> findByBookingId(String bookingId);

    List<GuestPass> findByBookingIdIn(Collection<String> bookingIds);

    List<GuestPass> findBySessionId(String sessionId);

    List<GuestPass> findBySessionIdIn(Collection<String> sessionIds);

    List<GuestPass> findBySessionIdOrderByPassNumberAsc(String sessionId);

    List<GuestPass> findByGuideId(String guideId);

    List<GuestPass> findByGuideIdOrderByCreatedAtDesc(String guideId);

    Page<GuestPass> findByGuideId(String guideId, Pageable pageable);

    boolean existsByBookingId(String bookingId);
    long countByBookingIdInAndAttendanceStatus(Collection<String> bookingIds, AttendanceStatus attendanceStatus);

    List<GuestPass> findByBookingIdInAndAttendanceStatus(Collection<String> bookingIds, AttendanceStatus attendanceStatus);

    List<GuestPass> findByBookingIdInAndStatusAndAttendanceStatus(
            Collection<String> bookingIds,
            GuestPassStatus status,
            AttendanceStatus attendanceStatus
    );
}

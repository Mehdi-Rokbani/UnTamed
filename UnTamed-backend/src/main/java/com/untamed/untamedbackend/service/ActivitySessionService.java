package com.untamed.untamedbackend.service;

import com.untamed.untamedbackend.booking.Booking;
import com.untamed.untamedbackend.booking.BookingRepository;
import com.untamed.untamedbackend.booking.BookingStatus;
import com.untamed.untamedbackend.booking.SessionSeatOps;
import com.untamed.untamedbackend.dto.*;
import com.untamed.untamedbackend.model.ActivityImage;
import com.untamed.untamedbackend.model.ActivitySession;
import com.untamed.untamedbackend.model.ActivityStatus;
import com.untamed.untamedbackend.model.ActivityTemplate;
import com.untamed.untamedbackend.model.RatingSummary;
import com.untamed.untamedbackend.model.Role;
import com.untamed.untamedbackend.model.User;
import com.untamed.untamedbackend.repository.ActivitySessionRepository;
import com.untamed.untamedbackend.repository.ActivityTemplateRepository;
import com.untamed.untamedbackend.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.util.Comparator;
import java.util.List;

@Service
@RequiredArgsConstructor
public class ActivitySessionService {

    private final ActivitySessionRepository sessionRepo;
    private final ActivityTemplateRepository templateRepo;
    private final UserRepository userRepo;
    private final BookingRepository bookingRepo;
    private final SessionSeatOps sessionSeatOps;

    private static final List<BookingStatus> ACTIVE_BOOKING_STATUSES = List.of(
            BookingStatus.PENDING,
            BookingStatus.PAYING,
            BookingStatus.COMPLETED
    );

    private static final List<BookingStatus> NON_BLOCKING_BOOKING_STATUSES = List.of(
            BookingStatus.CANCELLED,
            BookingStatus.EXPIRED
    );

    public List<ActivitySessionResponse> listMinePast(String authEmail) {
        User guide = getGuideByEmail(authEmail);
        Instant now = Instant.now();

        return sessionRepo.findByGuideId(guide.getId())
                .stream()
                .filter(s ->
                        s.getStartAt() != null && s.getStartAt().isBefore(now)
                                || s.getStatus() == ActivityStatus.COMPLETED
                                || s.getStatus() == ActivityStatus.CANCELLED
                )
                .sorted(Comparator.comparing(ActivitySession::getStartAt,
                        Comparator.nullsLast(Comparator.reverseOrder())))
                .map(this::toSessionResponse)
                .toList();
    }

    public List<ActivitySessionResponse> listMineUpcoming(String authEmail) {
        User guide = getGuideByEmail(authEmail);
        Instant now = Instant.now();

        return sessionRepo.findByGuideId(guide.getId())
                .stream()
                .filter(s ->
                        s.getStartAt() != null
                                && s.getStartAt().isAfter(now)
                                && s.getStatus() != ActivityStatus.COMPLETED
                                && s.getStatus() != ActivityStatus.CANCELLED
                )
                .sorted(Comparator.comparing(ActivitySession::getStartAt))
                .map(this::toSessionResponse)
                .toList();
    }

    public GuideSessionDetailsResponse getGuideSessionDetails(String sessionId, String authEmail) {
        User guide = getGuideByEmail(authEmail);

        ActivitySession session = sessionRepo.findByIdAndGuideId(sessionId, guide.getId())
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND,
                        "Session not found"
                ));

        List<Booking> bookings = bookingRepo.findBySessionIdOrderByCreatedAtAsc(sessionId);

        List<GuideParticipantDto> bookingDtos = bookings.stream()
                .map(booking -> {
                    User user = userRepo.findById(booking.getUserId()).orElse(null);

                    return new GuideParticipantDto(
                            booking.getId(),
                            booking.getUserId(),
                            user != null ? user.getUsername() : null,
                            user != null ? user.getEmail() : booking.getUserId(),
                            user != null ? user.getProfileImageUrl() : null,
                            booking.getNumberOfPeople(),
                            booking.getStatus(),
                            booking.getCreatedAt()
                    );
                })
                .toList();

        int totalPeople = bookings.stream()
                .mapToInt(Booking::getNumberOfPeople)
                .sum();

        return new GuideSessionDetailsResponse(
                toSessionResponse(session),
                bookingDtos,
                bookings.size(),
                totalPeople,
                countStatus(bookings, BookingStatus.PENDING),
                countStatus(bookings, BookingStatus.PAYING),
                countStatus(bookings, BookingStatus.COMPLETED),
                countStatus(bookings, BookingStatus.CANCELLED),
                countStatus(bookings, BookingStatus.EXPIRED)
        );
    }

    public ActivitySessionDeleteResponse deleteOrCancelSession(String sessionId, String authEmail) {
        User guide = getGuideByEmail(authEmail);

        ActivitySession session = sessionRepo.findByIdAndGuideId(sessionId, guide.getId())
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND,
                        "Session not found"
                ));

        Instant now = Instant.now();
        boolean isPast = session.getStartAt() != null && !session.getStartAt().isAfter(now);

        List<Booking> bookings = bookingRepo.findBySessionIdOrderByCreatedAtAsc(sessionId);

        if (bookings.isEmpty()) {
            if (isPast) {
                session.setStatus(ActivityStatus.CANCELLED);
                sessionRepo.save(session);

                return new ActivitySessionDeleteResponse(
                        sessionId,
                        "KEPT_HISTORY",
                        "Past session was kept in history and marked as cancelled."
                );
            }

            sessionRepo.deleteById(sessionId);

            return new ActivitySessionDeleteResponse(
                    sessionId,
                    "DELETED",
                    "Session deleted successfully."
            );
        }

        boolean hasCompleted = bookings.stream()
                .anyMatch(b -> b.getStatus() == BookingStatus.COMPLETED);

        boolean hasPaying = bookings.stream()
                .anyMatch(b -> b.getStatus() == BookingStatus.PAYING);

        if (hasPaying) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "Cannot delete this session because at least one booking is currently in progress."
            );
        }

        if (hasCompleted) {
            if (!isPast && session.getStatus() != ActivityStatus.CANCELLED) {
                session.setStatus(ActivityStatus.CANCELLED);
                sessionRepo.save(session);
            }

            return new ActivitySessionDeleteResponse(
                    sessionId,
                    "KEPT_HISTORY",
                    "Session has confirmed bookings, so it was kept for history."
            );
        }

        List<Booking> pendingBookings = bookings.stream()
                .filter(b -> b.getStatus() == BookingStatus.PENDING)
                .toList();

        int seatsToRelease = pendingBookings.stream()
                .mapToInt(Booking::getNumberOfPeople)
                .sum();

        if (seatsToRelease > 0) {
            sessionSeatOps.releaseSeats(sessionId, seatsToRelease);
        }

        Instant updateTime = Instant.now();

        for (Booking booking : pendingBookings) {
            booking.setNumberOfPeople(0);
            booking.setStatus(BookingStatus.CANCELLED);
            booking.setUpdatedAt(updateTime);
            booking.setExpiresAt(null);
        }

        if (!pendingBookings.isEmpty()) {
            bookingRepo.saveAll(pendingBookings);
        }

        session.setStatus(ActivityStatus.CANCELLED);
        sessionRepo.save(session);

        return new ActivitySessionDeleteResponse(
                sessionId,
                "CANCELLED",
                "Session was cancelled and pending bookings were cancelled."
        );
    }

    private int countStatus(List<Booking> bookings, BookingStatus status) {
        return (int) bookings.stream()
                .filter(b -> b.getStatus() == status)
                .count();
    }

    // list published sessions (public)
    public List<ActivitySessionResponse> listPublished() {
        return sessionRepo.findByStatus(ActivityStatus.PUBLISHED)
                .stream()
                .map(this::toSessionResponse)
                .toList();
    }

    // guide dashboard: list my sessions
    public List<ActivitySessionResponse> listMine(String authEmail) {
        User guide = getGuideByEmail(authEmail);
        return sessionRepo.findByGuideId(guide.getId())
                .stream()
                .map(this::toSessionResponse)
                .toList();
    }

    public ActivitySessionResponse getSessionById(String sessionId, String authEmailOrNull) {
        ActivitySession s = sessionRepo.findById(sessionId)
                .orElseThrow(() -> new IllegalArgumentException("Session not found"));

        if (s.getStatus() != ActivityStatus.PUBLISHED) {
            if (authEmailOrNull == null) {
                throw new IllegalArgumentException("Session not found");
            }

            User u = userRepo.findByEmail(authEmailOrNull)
                    .orElseThrow(() -> new IllegalArgumentException("User not found"));

            if (!s.getGuideId().equals(u.getId())) {
                throw new IllegalArgumentException("Session not found");
            }
        }

        return toSessionResponse(s);
    }

    public ActivitySessionResponse createSession(String templateId, ActivitySessionCreateRequest req, String authEmail) {
        User guide = getGuideByEmail(authEmail);

        ActivityTemplate t = templateRepo.findByIdAndGuideId(templateId, guide.getId())
                .orElseThrow(() -> new IllegalArgumentException("Not allowed or template not found"));

        validateCreateRequest(req);

        ActivitySession s = ActivitySession.builder()
                .templateId(t.getId())
                .guideId(t.getGuideId())
                .startAt(req.startAt())
                .endAt(req.endAt())
                .capacity(req.capacity())
                .bookedCount(0)
                .status(ActivityStatus.DRAFT)
                .meetingPoint(normalize(req.meetingPoint()))
                .sessionNote(normalize(req.sessionNote()))
                .build();

        return toSessionResponse(sessionRepo.save(s));
    }

    public ActivitySessionResponse updateSession(String sessionId, ActivitySessionUpdateRequest req, String authEmail) {
        User guide = getGuideByEmail(authEmail);

        ActivitySession s = sessionRepo.findByIdAndGuideId(sessionId, guide.getId())
                .orElseThrow(() -> new IllegalArgumentException("Not allowed or session not found"));

        Instant finalStartAt = req.startAt() != null ? req.startAt() : s.getStartAt();
        Instant finalEndAt = req.endAt() != null ? req.endAt() : s.getEndAt();

        validateTimeRange(finalStartAt, finalEndAt);

        if (req.startAt() != null) {
            if (!req.startAt().isAfter(Instant.now())) {
                throw new IllegalArgumentException("Start time must be in the future");
            }
            s.setStartAt(req.startAt());
        }

        if (req.endAt() != null) {
            s.setEndAt(req.endAt());
        }

        if (req.capacity() != null) {
            if (req.capacity() < 1) {
                throw new IllegalArgumentException("Capacity must be >= 1");
            }
            s.setCapacity(req.capacity());
        }

        if (req.meetingPoint() != null) {
            s.setMeetingPoint(normalize(req.meetingPoint()));
        }

        if (req.sessionNote() != null) {
            s.setSessionNote(normalize(req.sessionNote()));
        }

        if (req.status() != null) {
            if (req.status() == ActivityStatus.PUBLISHED) {
                ensureTemplateIsPublishable(s.getTemplateId());

                if (finalStartAt == null || !finalStartAt.isAfter(Instant.now())) {
                    throw new IllegalArgumentException("Session start time must be in the future before publishing");
                }

                if (finalEndAt == null || !finalEndAt.isAfter(finalStartAt)) {
                    throw new IllegalArgumentException("Session end time must be after start time before publishing");
                }
            }

            s.setStatus(req.status());
        }

        return toSessionResponse(sessionRepo.save(s));
    }

    public ActivitySessionResponse setStatus(String sessionId, ActivityStatus status, String authEmail) {
        return updateSession(
                sessionId,
                new ActivitySessionUpdateRequest(null, null, null, status, null, null),
                authEmail
        );
    }

    // ---- helpers ----

    private void validateCreateRequest(ActivitySessionCreateRequest req) {
        if (req.startAt() == null || !req.startAt().isAfter(Instant.now())) {
            throw new IllegalArgumentException("Start time must be in the future");
        }
        if (req.capacity() < 1) {
            throw new IllegalArgumentException("Capacity must be >= 1");
        }
        validateTimeRange(req.startAt(), req.endAt());
    }

    private void validateTimeRange(Instant startAt, Instant endAt) {
        if (startAt == null) {
            throw new IllegalArgumentException("Start time is required");
        }
        if (endAt == null) {
            throw new IllegalArgumentException("End time is required");
        }
        if (!endAt.isAfter(startAt)) {
            throw new IllegalArgumentException("End time must be after start time");
        }
    }

    private String normalize(String value) {
        if (value == null) return null;
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    private void ensureTemplateIsPublishable(String templateId) {
        ActivityTemplate t = templateRepo.findById(templateId)
                .orElseThrow(() -> new IllegalArgumentException("Template not found"));

        if (t.getAddressId() == null || t.getAddressId().isBlank()) {
            throw new IllegalArgumentException("Template must have a location before publishing sessions");
        }
        if (t.getLocation() == null) {
            throw new IllegalArgumentException("Template must have coordinates before publishing sessions");
        }
        if (t.getImages() == null || t.getImages().isEmpty()) {
            throw new IllegalArgumentException("Template must have at least one image before publishing sessions");
        }
        if (t.getCategoryIds() == null || t.getCategoryIds().isEmpty()) {
            throw new IllegalArgumentException("Template must have at least one category before publishing sessions");
        }
    }

    private User getGuideByEmail(String authEmail) {
        User u = userRepo.findByEmail(authEmail)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));
        if (u.getRole() != Role.GUIDE) {
            throw new IllegalArgumentException("Only GUIDE can manage activities");
        }
        return u;
    }

    private ActivitySessionResponse toSessionResponse(ActivitySession s) {
        ActivityTemplate t = templateRepo.findById(s.getTemplateId()).orElse(null);

        RatingSummaryDto ratingDto = new RatingSummaryDto(0.0, 0);
        ActivityTemplateMiniDto tplMini = null;

        if (t != null) {
            RatingSummary r = t.getRating() == null
                    ? RatingSummary.builder().average(0.0).count(0).build()
                    : t.getRating();

            ratingDto = new RatingSummaryDto(r.getAverage(), r.getCount());

            tplMini = new ActivityTemplateMiniDto(
                    t.getId(),
                    t.getTitle(),
                    t.getPrice(),
                    t.getDifficulty(),
                    t.getGuideId(),
                    t.getTags(),
                    t.getImages() == null
                            ? null
                            : t.getImages().stream()
                            .filter(ActivityImage::isCover)
                            .findFirst()
                            .map(ActivityImage::getUrl)
                            .orElse(null),
                    t.getCategoryIds()
            );
        }

        return new ActivitySessionResponse(
                s.getId(),
                s.getTemplateId(),
                s.getGuideId(),
                s.getStartAt(),
                s.getEndAt(),
                s.getCapacity(),
                s.getBookedCount(),
                s.getStatus(),
                s.getMeetingPoint(),
                s.getSessionNote(),
                tplMini,
                ratingDto
        );
    }

}
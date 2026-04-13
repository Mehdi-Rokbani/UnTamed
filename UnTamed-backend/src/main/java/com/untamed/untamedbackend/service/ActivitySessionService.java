package com.untamed.untamedbackend.service;

import com.untamed.untamedbackend.dto.ActivitySessionCreateRequest;
import com.untamed.untamedbackend.dto.ActivitySessionResponse;
import com.untamed.untamedbackend.dto.ActivitySessionUpdateRequest;
import com.untamed.untamedbackend.dto.ActivityTemplateMiniDto;
import com.untamed.untamedbackend.dto.RatingSummaryDto;
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
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.List;

@Service
@RequiredArgsConstructor
public class ActivitySessionService {

    private final ActivitySessionRepository sessionRepo;
    private final ActivityTemplateRepository templateRepo;
    private final UserRepository userRepo;

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
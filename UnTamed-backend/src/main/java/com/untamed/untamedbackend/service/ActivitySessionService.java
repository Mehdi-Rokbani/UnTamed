package com.untamed.untamedbackend.service;

import com.untamed.untamedbackend.dto.*;
import com.untamed.untamedbackend.model.*;
import com.untamed.untamedbackend.repository.*;
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

        // visibility rule like you had:
        if (s.getStatus() != ActivityStatus.PUBLISHED) {
            if (authEmailOrNull == null) throw new IllegalArgumentException("Session not found");
            User u = userRepo.findById(authEmailOrNull)
                    .orElseThrow(() -> new IllegalArgumentException("User not found"));
            if (!s.getGuideId().equals(u.getId())) throw new IllegalArgumentException("Session not found");
        }

        return toSessionResponse(s);
    }

    // create a date under a template
    public ActivitySessionResponse createSession(String templateId, ActivitySessionCreateRequest req, String authEmail) {
        User guide = getGuideByEmail(authEmail);

        ActivityTemplate t = templateRepo.findByIdAndGuideId(templateId, guide.getId())
                .orElseThrow(() -> new IllegalArgumentException("Not allowed or template not found"));

        if (req.date() == null || !req.date().isAfter(Instant.now())) {
            throw new IllegalArgumentException("Date must be in the future");
        }
        if (req.capacity() < 1) throw new IllegalArgumentException("Capacity must be >= 1");

        ActivitySession s = ActivitySession.builder()
                .templateId(t.getId())
                .guideId(t.getGuideId())
                .date(req.date())
                .capacity(req.capacity())
                .bookedCount(0)
                .status(ActivityStatus.DRAFT)
                .build();

        return toSessionResponse(sessionRepo.save(s));
    }

    public ActivitySessionResponse updateSession(String sessionId, ActivitySessionUpdateRequest req, String authEmail) {
        User guide = getGuideByEmail(authEmail);

        ActivitySession s = sessionRepo.findByIdAndGuideId(sessionId, guide.getId())
                .orElseThrow(() -> new IllegalArgumentException("Not allowed or session not found"));

        if (req.date() != null) {
            if (!req.date().isAfter(Instant.now())) throw new IllegalArgumentException("Date must be in the future");
            s.setDate(req.date());
        }

        if (req.capacity() != null) {
            if (req.capacity() < 1) throw new IllegalArgumentException("Capacity must be >= 1");
            s.setCapacity(req.capacity());
        }

        if (req.status() != null) {
            // Publishing rules (moved from Activity -> Session)
            if (req.status() == ActivityStatus.PUBLISHED) {
                ensureTemplateIsPublishable(s.getTemplateId());
                if (s.getDate() == null || !s.getDate().isAfter(Instant.now())) {
                    throw new IllegalArgumentException("Session date must be in the future before publishing");
                }
            }
            s.setStatus(req.status());
        }

        return toSessionResponse(sessionRepo.save(s));
    }

    public ActivitySessionResponse setStatus(String sessionId, ActivityStatus status, String authEmail) {
        return updateSession(sessionId, new ActivitySessionUpdateRequest(null, null, status), authEmail);
    }

    // ---- helpers ----

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
        if (u.getRole() != Role.GUIDE) throw new IllegalArgumentException("Only GUIDE can manage activities");
        return u;
    }

    private ActivitySessionResponse toSessionResponse(ActivitySession s) {
        ActivityTemplate t = templateRepo.findById(s.getTemplateId()).orElse(null);

        RatingSummaryDto ratingDto = new RatingSummaryDto(0.0, 0);
        ActivityTemplateMiniDto tplMini = null;

        if (t != null) {
            RatingSummary r = t.getRating() == null ? RatingSummary.builder().average(0.0).count(0).build() : t.getRating();
            ratingDto = new RatingSummaryDto(r.getAverage(), r.getCount());

            tplMini = new ActivityTemplateMiniDto(
                    t.getId(),
                    t.getTitle(),
                    t.getPrice(),
                    t.getDifficulty(),
                    t.getGuideId(),
                    t.getTags(),
                    // cover image url (optional)
                    t.getImages() == null ? null : t.getImages().stream().filter(ActivityImage::isCover).findFirst().map(ActivityImage::getUrl).orElse(null),
                    t.getCategoryIds()
            );
        }

        return new ActivitySessionResponse(
                s.getId(),
                s.getTemplateId(),
                s.getGuideId(),
                s.getDate(),
                s.getCapacity(),
                s.getBookedCount(),
                s.getStatus(),
                tplMini,
                ratingDto
        );
    }
}
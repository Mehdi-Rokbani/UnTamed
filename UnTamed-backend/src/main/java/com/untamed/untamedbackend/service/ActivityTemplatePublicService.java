package com.untamed.untamedbackend.service;

import com.untamed.untamedbackend.dto.*;
import com.untamed.untamedbackend.model.*;
import com.untamed.untamedbackend.repository.ActivitySessionRepository;
import com.untamed.untamedbackend.repository.ActivityTemplateRepository;
import com.untamed.untamedbackend.repository.UserRepository;
import com.untamed.untamedbackend.repository.AddressRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.List;

@Service
@RequiredArgsConstructor
public class ActivityTemplatePublicService {

    private final ActivityTemplateRepository templateRepo;
    private final ActivitySessionRepository sessionRepo;
    private final UserRepository userRepo;
    private final AddressRepository addressRepo;

    public List<PublicTemplateCardResponse> list() {
        Instant now = Instant.now();
        return templateRepo.findAll().stream()
                .map(t -> toCard(t, now))
                .filter(card -> card.nextSession() != null)
                .toList();
    }

    public PublicTemplateCardResponse get(String templateId) {
        Instant now = Instant.now();
        ActivityTemplate t = templateRepo.findById(templateId)
                .orElseThrow(() -> new IllegalArgumentException("Template not found"));
        return toCard(t, now);
    }

    private PublicTemplateCardResponse toCard(ActivityTemplate t, Instant now) {

        // ── Rating ──
        RatingSummary r = t.getRating() == null
                ? RatingSummary.builder().average(0.0).count(0).build()
                : t.getRating();
        RatingSummaryDto ratingDto = new RatingSummaryDto(r.getAverage(), r.getCount());

        // ── Cover URL ──
        String coverUrl = null;
        if (t.getImages() != null && !t.getImages().isEmpty()) {
            coverUrl = t.getImages().stream()
                    .filter(ActivityImage::isCover)
                    .findFirst()
                    .map(ActivityImage::getUrl)
                    .orElse(t.getImages().get(0).getUrl());
        }

        // ── Images list ──
        List<ActivityImageDto> imageDtos = t.getImages() == null ? List.of() :
                t.getImages().stream()
                        .sorted(java.util.Comparator.comparingInt(ActivityImage::getOrder))
                        .map(img -> new ActivityImageDto(
                                img.getUrl(),
                                img.getPublicId(),
                                img.getAlt(),
                                img.isCover(),
                                img.getOrder()
                        ))
                        .toList();

        // ── Next session ──
        PublicNextSessionDto next = sessionRepo
                .findFirstByTemplateIdAndStatusAndDateAfterOrderByDateAsc(
                        t.getId(), ActivityStatus.PUBLISHED, now)
                .map(s -> new PublicNextSessionDto(
                        s.getId(), s.getDate(), s.getCapacity(), s.getBookedCount()))
                .orElse(null);

        // ── Total booked count ──
        int totalBookedCount = sessionRepo.findByTemplateId(t.getId())
                .stream()
                .mapToInt(ActivitySession::getBookedCount)
                .sum();

        // ── Guide ──
        PublicGuideDto guideDto = null;
        User guide = userRepo.findById(t.getGuideId()).orElse(null);
        if (guide != null) {
            User.GuideProfile gp = guide.getGuideProfile();
            RatingSummaryDto guideRating = (gp != null && gp.getRatingSummary() != null)
                    ? new RatingSummaryDto(
                    gp.getRatingSummary().getAverage(),
                    gp.getRatingSummary().getCount())
                    : new RatingSummaryDto(0.0, 0);

            guideDto = new PublicGuideDto(
                    guide.getId(),
                    guide.getUsername(),
                    guide.getProfileImageUrl(),
                    gp != null && Boolean.TRUE.equals(gp.getVerifiedBadge()),
                    guideRating,
                    gp != null ? gp.getExperienceYears() : null
            );
        }

        // ── Address ──
        String addressDisplayName = null;
        String governorate = null;
        Double latitude = null;
        Double longitude = null;

        if (t.getAddressId() != null) {
            addressRepo.findById(t.getAddressId()).ifPresent(addr -> {
                // handled below via local vars workaround
            });
            // Using orElse pattern to avoid effectively-final issue in lambda
            var addr = addressRepo.findById(t.getAddressId()).orElse(null);
            if (addr != null) {
                addressDisplayName = addr.getDisplayName();
                governorate = addr.getGovernorate();
                latitude = addr.getLatitude();
                longitude = addr.getLongitude();
            }
        }

        return new PublicTemplateCardResponse(
                t.getId(),
                t.getTitle(),
                t.getDescription(),
                t.getDifficulty(),
                t.getPrice(),
                t.getTags() == null ? List.of() : t.getTags(),
                coverUrl,
                ratingDto,
                next,
                listUpcomingSessions(t.getId()).size(),
                imageDtos,
                addressDisplayName,
                governorate,
                latitude,
                longitude,
                totalBookedCount,
                guideDto
        );
    }

    public List<PublicSessionDto> listUpcomingSessions(String templateId) {
        templateRepo.findById(templateId)
                .orElseThrow(() -> new IllegalArgumentException("Template not found"));

        Instant now = Instant.now();
        return sessionRepo
                .findByTemplateIdAndStatusAndDateAfterOrderByDateAsc(
                        templateId, ActivityStatus.PUBLISHED, now)
                .stream()
                .map(s -> new PublicSessionDto(
                        s.getId(), s.getDate(), s.getCapacity(), s.getBookedCount()))
                .toList();
    }
}
package com.untamed.untamedbackend.service;

import com.untamed.untamedbackend.dto.*;
import com.untamed.untamedbackend.model.*;
import com.untamed.untamedbackend.repository.ActivitySessionRepository;
import com.untamed.untamedbackend.repository.ActivityTemplateRepository;
import com.untamed.untamedbackend.repository.AddressRepository;
import com.untamed.untamedbackend.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class ActivityTemplatePublicService {

    private final ActivityTemplateRepository templateRepo;
    private final ActivitySessionRepository sessionRepo;
    private final UserRepository userRepo;
    private final AddressRepository addressRepo;
    private final MongoTemplate mongo;

    public List<PublicTemplateCardResponse> list() {
        Instant now = Instant.now();

        return templateRepo.findAll()
                .stream()
                .filter(t -> !t.isArchived())
                .map(t -> toCard(t, now))
                .filter(card -> card.nextSession() != null)
                .toList();
    }

    public PaginatedResponse<PublicTemplateCardResponse> listPage(int page, int size) {
        Instant now = Instant.now();
        Page<ActivityTemplate> templatePage = templateRepo.findByArchivedFalse(
                PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "createdAt"))
        );

        List<PublicTemplateCardResponse> cards = templatePage.getContent()
                .stream()
                .map(t -> toCard(t, now))
                .filter(card -> card.nextSession() != null)
                .toList();

        return PaginatedResponse.from(templatePage, cards);
    }

    public PublicTemplateCardResponse get(String templateId) {
        Instant now = Instant.now();

        ActivityTemplate t = templateRepo.findById(templateId)
                .orElseThrow(() -> new IllegalArgumentException("Template not found"));

        if (t.isArchived()) {
            throw new IllegalArgumentException("Template not found");
        }

        return toCard(t, now);
    }

    public List<PublicSessionDto> listUpcomingSessions(String templateId) {
        ActivityTemplate template = templateRepo.findById(templateId)
                .orElseThrow(() -> new IllegalArgumentException("Template not found"));

        if (template.isArchived()) {
            throw new IllegalArgumentException("Template not found");
        }

        Instant now = Instant.now();

        return sessionRepo
                .findByTemplateIdAndStatusAndStartAtAfterOrderByStartAtAsc(
                        templateId,
                        ActivityStatus.PUBLISHED,
                        now
                )
                .stream()
                .map(s -> new PublicSessionDto(
                        s.getId(),
                        s.getStartAt(),
                        s.getEndAt(),
                        s.getCapacity(),
                        s.getBookedCount()
                ))
                .toList();
    }

    public List<PublicTemplateCardResponse> search(TemplateSearchCriteria c) {
        Query query = new Query();
        List<Criteria> criteriaList = new ArrayList<>();

        // Hide archived templates from public search.
        criteriaList.add(Criteria.where("archived").ne(true));

        boolean hasAddressId = c.addressId() != null && !c.addressId().isBlank();
        boolean hasQ = c.q() != null && !c.q().isBlank();

        // Exact selected address from suggestions
        if (hasAddressId) {
            criteriaList.add(Criteria.where("address_id").is(c.addressId()));
        }
        // Typed address search by display name
        else if (hasQ) {
            List<String> addressIds = addressRepo
                    .findTop10ByDisplayNameContainingIgnoreCaseOrderByUsesCountDesc(c.q())
                    .stream()
                    .map(Address::getId)
                    .toList();

            if (addressIds.isEmpty()) {
                return List.of();
            }

            criteriaList.add(Criteria.where("address_id").in(addressIds));
        }

        if (c.categoryIds() != null && !c.categoryIds().isEmpty()) {
            List<String> cleanedCategoryIds = c.categoryIds()
                    .stream()
                    .filter(id -> id != null && !id.isBlank())
                    .toList();

            if (!cleanedCategoryIds.isEmpty()) {
                criteriaList.add(Criteria.where("category_ids").in(cleanedCategoryIds));
            }
        }

        if (c.difficulty() != null) {
            criteriaList.add(Criteria.where("difficulty").is(c.difficulty()));
        }

        if (c.minPrice() != null || c.maxPrice() != null) {
            Criteria priceCriteria = Criteria.where("price");

            if (c.minPrice() != null) {
                priceCriteria.gte(c.minPrice());
            }

            if (c.maxPrice() != null) {
                priceCriteria.lte(c.maxPrice());
            }

            criteriaList.add(priceCriteria);
        }

        // Date filtering is based on sessions, not templates.
        Set<String> templateIdsMatchingDate = findTemplateIdsMatchingDateRange(c.dateFrom(), c.dateTo());

        if (templateIdsMatchingDate != null) {
            if (templateIdsMatchingDate.isEmpty()) {
                return List.of();
            }

            criteriaList.add(Criteria.where("_id").in(templateIdsMatchingDate));
        }

        if (!criteriaList.isEmpty()) {
            query.addCriteria(new Criteria().andOperator(criteriaList.toArray(new Criteria[0])));
        }

        Instant now = Instant.now();

        List<PublicTemplateCardResponse> cards = mongo.find(query, ActivityTemplate.class)
                .stream()
                .filter(t -> !t.isArchived())
                .map(t -> toCard(t, now))
                .filter(card -> card.nextSession() != null)
                .toList();

        return sortResults(cards, c.sort());
    }

    public PaginatedResponse<PublicTemplateCardResponse> searchPage(TemplateSearchCriteria c, int page, int size) {
        SearchQueryBuild build = buildSearchQuery(c);

        if (build.empty()) {
            return PaginatedResponse.of(List.of(), page, size, 0);
        }

        Query query = build.query();
        long total = mongo.count(query, ActivityTemplate.class);

        query.with(PageRequest.of(page, size, sortForSearch(c.sort())));

        Instant now = Instant.now();
        List<PublicTemplateCardResponse> cards = mongo.find(query, ActivityTemplate.class)
                .stream()
                .filter(t -> !t.isArchived())
                .map(t -> toCard(t, now))
                .filter(card -> card.nextSession() != null)
                .toList();

        return PaginatedResponse.of(sortResults(cards, c.sort()), page, size, total);
    }

    private SearchQueryBuild buildSearchQuery(TemplateSearchCriteria c) {
        Query query = new Query();
        List<Criteria> criteriaList = new ArrayList<>();

        criteriaList.add(Criteria.where("archived").ne(true));

        boolean hasAddressId = c.addressId() != null && !c.addressId().isBlank();
        boolean hasQ = c.q() != null && !c.q().isBlank();

        if (hasAddressId) {
            criteriaList.add(Criteria.where("address_id").is(c.addressId()));
        } else if (hasQ) {
            List<String> addressIds = addressRepo
                    .findTop10ByDisplayNameContainingIgnoreCaseOrderByUsesCountDesc(c.q())
                    .stream()
                    .map(Address::getId)
                    .toList();

            if (addressIds.isEmpty()) {
                return new SearchQueryBuild(query, true);
            }

            criteriaList.add(Criteria.where("address_id").in(addressIds));
        }

        if (c.categoryIds() != null && !c.categoryIds().isEmpty()) {
            List<String> cleanedCategoryIds = c.categoryIds()
                    .stream()
                    .filter(id -> id != null && !id.isBlank())
                    .toList();

            if (!cleanedCategoryIds.isEmpty()) {
                criteriaList.add(Criteria.where("category_ids").in(cleanedCategoryIds));
            }
        }

        if (c.difficulty() != null) {
            criteriaList.add(Criteria.where("difficulty").is(c.difficulty()));
        }

        if (c.minPrice() != null || c.maxPrice() != null) {
            Criteria priceCriteria = Criteria.where("price");

            if (c.minPrice() != null) {
                priceCriteria.gte(c.minPrice());
            }

            if (c.maxPrice() != null) {
                priceCriteria.lte(c.maxPrice());
            }

            criteriaList.add(priceCriteria);
        }

        Set<String> templateIdsMatchingDate = findTemplateIdsMatchingDateRange(c.dateFrom(), c.dateTo());

        if (templateIdsMatchingDate != null) {
            if (templateIdsMatchingDate.isEmpty()) {
                return new SearchQueryBuild(query, true);
            }

            criteriaList.add(Criteria.where("_id").in(templateIdsMatchingDate));
        }

        query.addCriteria(new Criteria().andOperator(criteriaList.toArray(new Criteria[0])));
        return new SearchQueryBuild(query, false);
    }

    private Sort sortForSearch(String sort) {
        if (sort == null || sort.isBlank()) {
            return Sort.by(Sort.Direction.DESC, "createdAt");
        }

        return switch (sort) {
            case "priceAsc" -> Sort.by(Sort.Direction.ASC, "price");
            case "priceDesc" -> Sort.by(Sort.Direction.DESC, "price");
            case "rating" -> Sort.by(Sort.Direction.DESC, "rating.average");
            default -> Sort.by(Sort.Direction.DESC, "createdAt");
        };
    }

    private record SearchQueryBuild(Query query, boolean empty) {}

    private Set<String> findTemplateIdsMatchingDateRange(Instant dateFrom, Instant dateTo) {
        boolean hasDateFrom = dateFrom != null;
        boolean hasDateTo = dateTo != null;

        if (!hasDateFrom && !hasDateTo) {
            return null;
        }

        List<ActivitySession> sessions;

        if (hasDateFrom && hasDateTo) {
            sessions = sessionRepo.findByStatusAndStartAtBetween(
                    ActivityStatus.PUBLISHED,
                    dateFrom,
                    dateTo
            );
        } else if (hasDateFrom) {
            sessions = sessionRepo.findByStatusAndStartAtAfter(
                    ActivityStatus.PUBLISHED,
                    dateFrom
            );
        } else {
            sessions = sessionRepo.findByStatusAndStartAtBefore(
                    ActivityStatus.PUBLISHED,
                    dateTo
            );
        }

        Set<String> templateIds = sessions.stream()
                .map(ActivitySession::getTemplateId)
                .collect(Collectors.toSet());

        if (templateIds.isEmpty()) {
            return Set.of();
        }

        return templateRepo.findAllById(templateIds)
                .stream()
                .filter(t -> !t.isArchived())
                .map(ActivityTemplate::getId)
                .collect(Collectors.toSet());
    }

    private PublicTemplateCardResponse toCard(ActivityTemplate t, Instant now) {
        RatingSummary r = t.getRating() == null
                ? RatingSummary.builder().average(0.0).count(0).build()
                : t.getRating();

        RatingSummaryDto ratingDto = new RatingSummaryDto(r.getAverage(), r.getCount());

        String coverUrl = null;

        if (t.getImages() != null && !t.getImages().isEmpty()) {
            coverUrl = t.getImages()
                    .stream()
                    .filter(ActivityImage::isCover)
                    .findFirst()
                    .map(ActivityImage::getUrl)
                    .orElse(t.getImages().get(0).getUrl());
        }

        List<ActivityImageDto> imageDtos = t.getImages() == null
                ? List.of()
                : t.getImages()
                .stream()
                .sorted(Comparator.comparingInt(ActivityImage::getOrder))
                .map(img -> new ActivityImageDto(
                        img.getUrl(),
                        img.getPublicId(),
                        img.getAlt(),
                        img.isCover(),
                        img.getOrder()
                ))
                .toList();

        PublicNextSessionDto next = sessionRepo
                .findFirstByTemplateIdAndStatusAndStartAtAfterOrderByStartAtAsc(
                        t.getId(),
                        ActivityStatus.PUBLISHED,
                        now
                )
                .map(s -> new PublicNextSessionDto(
                        s.getId(),
                        s.getStartAt(),
                        s.getCapacity(),
                        s.getBookedCount()
                ))
                .orElse(null);

        int totalBookedCount = sessionRepo.findByTemplateId(t.getId())
                .stream()
                .mapToInt(ActivitySession::getBookedCount)
                .sum();

        PublicGuideDto guideDto = null;

        User guide = userRepo.findById(t.getGuideId()).orElse(null);

        if (guide != null) {
            User.GuideProfile gp = guide.getGuideProfile();

            RatingSummaryDto guideRating = (gp != null && gp.getRatingSummary() != null)
                    ? new RatingSummaryDto(
                    gp.getRatingSummary().getAverage(),
                    gp.getRatingSummary().getCount()
            )
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

        String addressDisplayName = null;
        String governorate = null;
        Double latitude = null;
        Double longitude = null;

        if (t.getAddressId() != null) {
            Address addr = addressRepo.findById(t.getAddressId()).orElse(null);

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

    private List<PublicTemplateCardResponse> sortResults(
            List<PublicTemplateCardResponse> list,
            String sort
    ) {
        if (sort == null || sort.isBlank()) {
            return list;
        }

        return switch (sort) {
            case "popular", "popularity" -> list.stream()
                    .sorted(Comparator.comparing(PublicTemplateCardResponse::totalBookedCount).reversed())
                    .toList();

            case "priceAsc" -> list.stream()
                    .sorted(Comparator.comparing(PublicTemplateCardResponse::price))
                    .toList();

            case "priceDesc" -> list.stream()
                    .sorted(Comparator.comparing(PublicTemplateCardResponse::price).reversed())
                    .toList();

            case "rating" -> list.stream()
                    .sorted(Comparator.comparing(
                            (PublicTemplateCardResponse card) -> card.rating().average(),
                            Comparator.reverseOrder()
                    ))
                    .toList();

            case "soonest" -> list.stream()
                    .sorted(Comparator.comparing(card -> card.nextSession().date()))
                    .toList();

            default -> list;
        };
    }
}

package com.untamed.untamedbackend.service;

import com.untamed.untamedbackend.booking.Booking;
import com.untamed.untamedbackend.booking.BookingRepository;
import com.untamed.untamedbackend.booking.BookingStatus;
import com.untamed.untamedbackend.dto.PublicUserProfileResponse;
import com.untamed.untamedbackend.dto.RatingSummaryDto;
import com.untamed.untamedbackend.guidereview.GuideReview;
import com.untamed.untamedbackend.guidereview.GuideReviewRepository;
import com.untamed.untamedbackend.model.ActivityImage;
import com.untamed.untamedbackend.model.ActivitySession;
import com.untamed.untamedbackend.model.ActivityStatus;
import com.untamed.untamedbackend.model.ActivityTemplate;
import com.untamed.untamedbackend.model.Address;
import com.untamed.untamedbackend.model.Category;
import com.untamed.untamedbackend.model.Review;
import com.untamed.untamedbackend.model.ReviewStatus;
import com.untamed.untamedbackend.model.Role;
import com.untamed.untamedbackend.model.User;
import com.untamed.untamedbackend.repository.ActivitySessionRepository;
import com.untamed.untamedbackend.repository.ActivityTemplateRepository;
import com.untamed.untamedbackend.repository.AddressRepository;
import com.untamed.untamedbackend.repository.CategoryRepository;
import com.untamed.untamedbackend.repository.ReviewRepository;
import com.untamed.untamedbackend.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class PublicUserProfileService {

    private static final int RECENT_REVIEWS_LIMIT = 5;
    private static final int GUIDE_ACTIVITIES_LIMIT = 6;

    private final UserRepository userRepository;
    private final BookingRepository bookingRepository;
    private final ActivitySessionRepository sessionRepository;
    private final ActivityTemplateRepository templateRepository;
    private final CategoryRepository categoryRepository;
    private final AddressRepository addressRepository;
    private final ReviewRepository reviewRepository;
    private final GuideReviewRepository guideReviewRepository;

    public PublicUserProfileResponse getPublicProfile(String userId) {
        User user = userRepository.findById(userId)
                .filter(candidate -> candidate.isEnabled() && !candidate.isSuspended())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));

        List<PublicUserProfileResponse.PublicTopCategoryDto> topCategories =
                isAdventurerRole(user.getRole()) ? buildTopCategories(user.getId()) : List.of();

        List<PublicUserProfileResponse.PublicUserActivityReviewDto> recentReviews =
                isAdventurerRole(user.getRole()) ? buildRecentActivityReviews(user.getId()) : List.of();

        PublicUserProfileResponse.PublicUserGuideProfileDto guideProfile = null;
        List<PublicUserProfileResponse.PublicGuideReviewDto> guideReviews = List.of();
        List<PublicUserProfileResponse.PublicGuideActivityCardDto> guideActivities = List.of();
        PublicUserProfileResponse.PublicGuideStatsDto guideStats = null;

        if (user.getRole() == Role.GUIDE) {
            guideProfile = buildGuideProfile(user);
            guideReviews = buildGuideReviews(user.getId());
            guideActivities = buildGuideActivities(user.getId());
            guideStats = buildGuideStats(user);
        }

        return new PublicUserProfileResponse(
                user.getId(),
                user.getUsername(),
                user.getRole(),
                user.getProfileImageUrl(),
                user.getBio(),
                user.getCreatedAt(),
                user.getLevel(),
                user.getLevelNumber(),
                user.getLevelTitle(),
                user.getLevelProgressPercent(),
                user.getConfirmedTripsCount(),
                user.getReviewsWrittenCount(),
                topCategories,
                recentReviews,
                guideProfile,
                guideReviews,
                guideActivities,
                guideStats
        );
    }

    private List<PublicUserProfileResponse.PublicTopCategoryDto> buildTopCategories(String userId) {
        List<Booking> completedBookings = bookingRepository.findByUserIdAndStatus(userId, BookingStatus.COMPLETED);
        if (completedBookings.isEmpty()) {
            return List.of();
        }

        Set<String> sessionIds = completedBookings.stream()
                .map(Booking::getSessionId)
                .filter(Objects::nonNull)
                .collect(Collectors.toSet());

        Map<String, ActivitySession> sessionsById = sessionRepository.findAllById(sessionIds)
                .stream()
                .collect(Collectors.toMap(ActivitySession::getId, Function.identity(), (a, b) -> a));

        Set<String> templateIds = sessionsById.values()
                .stream()
                .map(ActivitySession::getTemplateId)
                .filter(Objects::nonNull)
                .collect(Collectors.toSet());

        Map<String, ActivityTemplate> templatesById = templateRepository.findAllById(templateIds)
                .stream()
                .collect(Collectors.toMap(ActivityTemplate::getId, Function.identity(), (a, b) -> a));

        Set<String> categoryIds = templatesById.values()
                .stream()
                .flatMap(template -> safeList(template.getCategoryIds()).stream())
                .collect(Collectors.toSet());

        Map<String, Category> categoriesById = categoryRepository.findAllById(categoryIds)
                .stream()
                .collect(Collectors.toMap(Category::getId, Function.identity(), (a, b) -> a));

        Map<String, Integer> counts = new LinkedHashMap<>();
        for (Booking booking : completedBookings) {
            ActivitySession session = sessionsById.get(booking.getSessionId());
            ActivityTemplate template = session == null ? null : templatesById.get(session.getTemplateId());
            if (template == null) {
                continue;
            }
            safeList(template.getCategoryIds()).forEach(categoryId -> counts.merge(categoryId, 1, Integer::sum));
        }

        return counts.entrySet()
                .stream()
                .map(entry -> new PublicUserProfileResponse.PublicTopCategoryDto(
                        entry.getKey(),
                        categoryName(categoriesById.get(entry.getKey())),
                        entry.getValue()
                ))
                .sorted(Comparator.comparingInt(PublicUserProfileResponse.PublicTopCategoryDto::count).reversed())
                .limit(5)
                .toList();
    }

    private List<PublicUserProfileResponse.PublicUserActivityReviewDto> buildRecentActivityReviews(String userId) {
        List<Review> reviews = reviewRepository.findByReviewerIdAndStatus(
                userId,
                ReviewStatus.VISIBLE,
                PageRequest.of(0, RECENT_REVIEWS_LIMIT, Sort.by(Sort.Direction.DESC, "createdAt"))
        ).getContent();

        if (reviews.isEmpty()) {
            return List.of();
        }

        Set<String> templateIds = reviews.stream()
                .map(Review::getActivityTemplateId)
                .filter(Objects::nonNull)
                .collect(Collectors.toSet());

        Map<String, ActivityTemplate> templatesById = templateRepository.findAllById(templateIds)
                .stream()
                .collect(Collectors.toMap(ActivityTemplate::getId, Function.identity(), (a, b) -> a));

        return reviews.stream()
                .map(review -> {
                    ActivityTemplate template = templatesById.get(review.getActivityTemplateId());
                    return new PublicUserProfileResponse.PublicUserActivityReviewDto(
                            review.getId(),
                            review.getActivityTemplateId(),
                            template == null ? "Adventure" : template.getTitle(),
                            template == null ? null : coverImage(template),
                            review.getRating(),
                            review.getComment(),
                            review.getCreatedAt()
                    );
                })
                .toList();
    }

    private PublicUserProfileResponse.PublicUserGuideProfileDto buildGuideProfile(User guide) {
        User.GuideProfile profile = guide.getGuideProfile();
        if (profile == null) {
            return new PublicUserProfileResponse.PublicUserGuideProfileDto(
                    false,
                    null,
                    new RatingSummaryDto(0.0, 0),
                    0,
                    List.of()
            );
        }

        List<User.Certificate> certificates = safeList(profile.getCertificates());
        List<PublicUserProfileResponse.PublicCertificateDto> certificateDtos = certificates.stream()
                .map(certificate -> new PublicUserProfileResponse.PublicCertificateDto(
                        certificate.getId(),
                        certificate.getTitle(),
                        certificate.getIssuer(),
                        certificate.getIssuedAt(),
                        certificate.getExpiresAt(),
                        certificate.getVerificationUrl()
                ))
                .toList();

        return new PublicUserProfileResponse.PublicUserGuideProfileDto(
                Boolean.TRUE.equals(profile.getVerifiedBadge()),
                profile.getExperienceYears(),
                toRatingDto(profile.getRatingSummary()),
                certificates.size(),
                certificateDtos
        );
    }

    private List<PublicUserProfileResponse.PublicGuideReviewDto> buildGuideReviews(String guideId) {
        List<GuideReview> reviews = guideReviewRepository.findByGuideIdAndStatus(
                guideId,
                ReviewStatus.VISIBLE,
                PageRequest.of(0, RECENT_REVIEWS_LIMIT, Sort.by(Sort.Direction.DESC, "createdAt"))
        ).getContent();

        if (reviews.isEmpty()) {
            return List.of();
        }

        Set<String> reviewerIds = reviews.stream()
                .map(GuideReview::getReviewerId)
                .filter(Objects::nonNull)
                .collect(Collectors.toSet());

        Map<String, User> reviewersById = userRepository.findAllById(reviewerIds)
                .stream()
                .collect(Collectors.toMap(User::getId, Function.identity(), (a, b) -> a));

        return reviews.stream()
                .map(review -> {
                    User reviewer = reviewersById.get(review.getReviewerId());
                    return new PublicUserProfileResponse.PublicGuideReviewDto(
                            review.getId(),
                            reviewer == null ? "Adventurer" : reviewer.getUsername(),
                            reviewer == null ? null : reviewer.getProfileImageUrl(),
                            reviewer == null ? null : reviewer.getLevel(),
                            reviewer == null ? null : reviewer.getLevelTitle(),
                            review.getRating(),
                            review.getComment(),
                            review.getCreatedAt()
                    );
                })
                .toList();
    }

    private List<PublicUserProfileResponse.PublicGuideActivityCardDto> buildGuideActivities(String guideId) {
        List<ActivityTemplate> templates = templateRepository.findByGuideIdAndArchivedFalse(guideId)
                .stream()
                .sorted(Comparator.comparing(ActivityTemplate::getCreatedAt, Comparator.nullsLast(Comparator.reverseOrder())))
                .limit(GUIDE_ACTIVITIES_LIMIT)
                .toList();

        if (templates.isEmpty()) {
            return List.of();
        }

        Set<String> categoryIds = templates.stream()
                .flatMap(template -> safeList(template.getCategoryIds()).stream())
                .collect(Collectors.toSet());

        Map<String, Category> categoriesById = categoryRepository.findAllById(categoryIds)
                .stream()
                .collect(Collectors.toMap(Category::getId, Function.identity(), (a, b) -> a));

        Set<String> addressIds = templates.stream()
                .map(ActivityTemplate::getAddressId)
                .filter(Objects::nonNull)
                .collect(Collectors.toSet());

        Map<String, Address> addressesById = addressRepository.findAllById(addressIds)
                .stream()
                .collect(Collectors.toMap(Address::getId, Function.identity(), (a, b) -> a));

        return templates.stream()
                .map(template -> {
                    Address address = addressesById.get(template.getAddressId());
                    List<String> categoryNames = safeList(template.getCategoryIds())
                            .stream()
                            .map(categoriesById::get)
                            .map(this::categoryName)
                            .toList();

                    return new PublicUserProfileResponse.PublicGuideActivityCardDto(
                            template.getId(),
                            template.getTitle(),
                            coverImage(template),
                            template.getPrice(),
                            template.getDifficulty(),
                            categoryNames,
                            address == null ? null : address.getDisplayName(),
                            address == null ? null : address.getGovernorate(),
                            toRatingDto(template.getRating())
                    );
                })
                .toList();
    }

    private PublicUserProfileResponse.PublicGuideStatsDto buildGuideStats(User guide) {
        int activitiesCount = Math.toIntExact(templateRepository.countByGuideIdAndArchivedFalse(guide.getId()));
        long upcomingSessionsCount = sessionRepository.countByGuideIdAndStatusAndStartAtAfter(
                guide.getId(),
                ActivityStatus.PUBLISHED,
                Instant.now()
        );

        User.RatingSummary ratingSummary = guide.getGuideProfile() == null
                ? null
                : guide.getGuideProfile().getRatingSummary();

        int totalReviews = ratingSummary == null || ratingSummary.getCount() == null ? 0 : ratingSummary.getCount();
        double averageRating = ratingSummary == null || ratingSummary.getAverage() == null ? 0.0 : ratingSummary.getAverage();

        return new PublicUserProfileResponse.PublicGuideStatsDto(
                activitiesCount,
                upcomingSessionsCount,
                totalReviews,
                averageRating
        );
    }

    private boolean isAdventurerRole(Role role) {
        return role == Role.ADVENTURER || role == Role.USER;
    }

    private String coverImage(ActivityTemplate template) {
        return safeList(template.getImages())
                .stream()
                .filter(ActivityImage::isCover)
                .findFirst()
                .or(() -> safeList(template.getImages()).stream().findFirst())
                .map(ActivityImage::getUrl)
                .orElse(null);
    }

    private RatingSummaryDto toRatingDto(com.untamed.untamedbackend.model.RatingSummary rating) {
        if (rating == null) {
            return new RatingSummaryDto(0.0, 0);
        }
        return new RatingSummaryDto(rating.getAverage(), rating.getCount());
    }

    private RatingSummaryDto toRatingDto(User.RatingSummary rating) {
        if (rating == null) {
            return new RatingSummaryDto(0.0, 0);
        }
        return new RatingSummaryDto(
                rating.getAverage() == null ? 0.0 : rating.getAverage(),
                rating.getCount() == null ? 0 : rating.getCount()
        );
    }

    private String categoryName(Category category) {
        return category == null || category.getName() == null || category.getName().isBlank()
                ? "Unknown category"
                : category.getName();
    }

    private <T> List<T> safeList(List<T> value) {
        return value == null ? List.of() : value;
    }
}

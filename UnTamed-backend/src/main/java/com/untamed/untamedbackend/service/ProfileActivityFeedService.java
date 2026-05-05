package com.untamed.untamedbackend.service;

import com.untamed.untamedbackend.booking.Booking;
import com.untamed.untamedbackend.booking.BookingRepository;
import com.untamed.untamedbackend.booking.BookingStatus;
import com.untamed.untamedbackend.dto.PaginatedResponse;
import com.untamed.untamedbackend.dto.ProfileActivityFeedResponse;
import com.untamed.untamedbackend.dto.ProfileActivitySummaryDto;
import com.untamed.untamedbackend.dto.ProfileCompletedTripDto;
import com.untamed.untamedbackend.dto.ProfileReviewDto;
import com.untamed.untamedbackend.dto.ProfileTopCategoryDto;
import com.untamed.untamedbackend.dto.ProfileTripAttendanceSummaryDto;
import com.untamed.untamedbackend.guestpass.AttendanceStatus;
import com.untamed.untamedbackend.guestpass.GuestPass;
import com.untamed.untamedbackend.guestpass.GuestPassRepository;
import com.untamed.untamedbackend.guestpass.GuestPassStatus;
import com.untamed.untamedbackend.model.ActivityImage;
import com.untamed.untamedbackend.model.ActivitySession;
import com.untamed.untamedbackend.model.ActivityTemplate;
import com.untamed.untamedbackend.model.Address;
import com.untamed.untamedbackend.model.Category;
import com.untamed.untamedbackend.model.Review;
import com.untamed.untamedbackend.model.ReviewStatus;
import com.untamed.untamedbackend.repository.ActivitySessionRepository;
import com.untamed.untamedbackend.repository.ActivityTemplateRepository;
import com.untamed.untamedbackend.repository.AddressRepository;
import com.untamed.untamedbackend.repository.CategoryRepository;
import com.untamed.untamedbackend.repository.ReviewRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.ArrayList;
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
public class ProfileActivityFeedService {

    private static final int DEFAULT_SIZE = 10;

    private final BookingRepository bookingRepository;
    private final ActivitySessionRepository sessionRepository;
    private final ActivityTemplateRepository templateRepository;
    private final CategoryRepository categoryRepository;
    private final AddressRepository addressRepository;
    private final ReviewRepository reviewRepository;
    private final GuestPassRepository guestPassRepository;

    public ProfileActivityFeedResponse getFeed(
            String userId,
            int tripsPage,
            int tripsSize,
            int reviewsPage,
            int reviewsSize
    ) {
        int safeTripsSize = sanitizeSize(tripsSize);
        int safeReviewsSize = sanitizeSize(reviewsSize);

        Page<Booking> tripPage = bookingRepository.findByUserIdAndStatus(
                userId,
                BookingStatus.COMPLETED,
                PageRequest.of(sanitizePage(tripsPage), safeTripsSize, Sort.by(Sort.Direction.DESC, "createdAt"))
        );

        Page<Review> reviewPage = reviewRepository.findByReviewerId(
                userId,
                PageRequest.of(sanitizePage(reviewsPage), safeReviewsSize, Sort.by(Sort.Direction.DESC, "createdAt"))
        );

        List<Booking> allCompletedBookings =
                bookingRepository.findByUserIdAndStatusOrderByCreatedAtDesc(userId, BookingStatus.COMPLETED);

        List<Booking> pageBookings = tripPage.getContent();
        List<Review> pageReviews = reviewPage.getContent();

        Set<String> sessionIds = concat(
                pageBookings.stream().map(Booking::getSessionId),
                allCompletedBookings.stream().map(Booking::getSessionId)
        );

        Map<String, ActivitySession> sessionsById = sessionRepository.findAllById(sessionIds)
                .stream()
                .collect(Collectors.toMap(ActivitySession::getId, Function.identity(), (a, b) -> a));

        Set<String> templateIds = new java.util.LinkedHashSet<>();
        sessionsById.values().stream()
                .map(ActivitySession::getTemplateId)
                .filter(Objects::nonNull)
                .forEach(templateIds::add);
        pageReviews.stream()
                .map(Review::getActivityTemplateId)
                .filter(Objects::nonNull)
                .forEach(templateIds::add);

        Map<String, ActivityTemplate> templatesById = templateRepository.findAllById(templateIds)
                .stream()
                .collect(Collectors.toMap(ActivityTemplate::getId, Function.identity(), (a, b) -> a));

        Set<String> categoryIds = templatesById.values()
                .stream()
                .flatMap(template -> safeList(template.getCategoryIds()).stream())
                .collect(Collectors.toCollection(java.util.LinkedHashSet::new));

        Map<String, Category> categoriesById = categoryRepository.findAllById(categoryIds)
                .stream()
                .collect(Collectors.toMap(Category::getId, Function.identity(), (a, b) -> a));

        Set<String> addressIds = templatesById.values()
                .stream()
                .map(ActivityTemplate::getAddressId)
                .filter(Objects::nonNull)
                .collect(Collectors.toCollection(java.util.LinkedHashSet::new));

        Map<String, Address> addressesById = addressRepository.findAllById(addressIds)
                .stream()
                .collect(Collectors.toMap(Address::getId, Function.identity(), (a, b) -> a));

        List<String> pageBookingIds = pageBookings.stream().map(Booking::getId).toList();
        Map<String, List<GuestPass>> passesByBookingId = pageBookingIds.isEmpty()
                ? Map.of()
                : guestPassRepository.findByBookingIdIn(pageBookingIds)
                        .stream()
                        .collect(Collectors.groupingBy(GuestPass::getBookingId));

        Set<String> pageTripTemplateIds = pageBookings.stream()
                .map(Booking::getSessionId)
                .map(sessionsById::get)
                .filter(Objects::nonNull)
                .map(ActivitySession::getTemplateId)
                .filter(Objects::nonNull)
                .collect(Collectors.toSet());

        List<Review> existingReviews = pageTripTemplateIds.isEmpty()
                ? List.of()
                : reviewRepository.findByReviewerIdAndActivityTemplateIdIn(userId, new ArrayList<>(pageTripTemplateIds));

        Map<String, Review> reviewsByTemplateId = existingReviews.stream()
                .collect(Collectors.toMap(Review::getActivityTemplateId, Function.identity(), (a, b) -> a));

        List<ProfileCompletedTripDto> trips = pageBookings.stream()
                .map(booking -> toTripDto(
                        booking,
                        sessionsById,
                        templatesById,
                        addressesById,
                        categoriesById,
                        passesByBookingId.getOrDefault(booking.getId(), List.of()),
                        reviewsByTemplateId.get(templateIdForBooking(booking, sessionsById))
                ))
                .toList();

        List<ProfileReviewDto> reviews = pageReviews.stream()
                .map(review -> toReviewDto(review, templatesById, addressesById))
                .toList();

        List<ProfileTopCategoryDto> topCategories = buildTopCategories(
                allCompletedBookings,
                sessionsById,
                templatesById,
                categoriesById
        );

        ProfileActivitySummaryDto summary = new ProfileActivitySummaryDto(
                allCompletedBookings.size(),
                reviewPage.getTotalElements(),
                topCategories.isEmpty() ? null : topCategories.get(0).categoryName(),
                allCompletedBookings.stream().mapToInt(Booking::getNumberOfPeople).sum()
        );

        return new ProfileActivityFeedResponse(
                PaginatedResponse.from(tripPage, trips),
                PaginatedResponse.from(reviewPage, reviews),
                topCategories,
                summary
        );
    }

    private ProfileCompletedTripDto toTripDto(
            Booking booking,
            Map<String, ActivitySession> sessionsById,
            Map<String, ActivityTemplate> templatesById,
            Map<String, Address> addressesById,
            Map<String, Category> categoriesById,
            List<GuestPass> passes,
            Review existingReview
    ) {
        ActivitySession session = sessionsById.get(booking.getSessionId());
        ActivityTemplate template = session != null ? templatesById.get(session.getTemplateId()) : null;
        Address address = template != null ? addressesById.get(template.getAddressId()) : null;
        List<String> categoryIds = template == null ? List.of() : safeList(template.getCategoryIds());
        List<String> categoryNames = categoryIds.stream()
                .map(categoriesById::get)
                .filter(Objects::nonNull)
                .map(Category::getName)
                .toList();

        return new ProfileCompletedTripDto(
                booking.getId(),
                booking.getSessionId(),
                template != null ? template.getId() : null,
                template != null ? template.getTitle() : "Adventure",
                template != null ? coverImage(template) : null,
                address != null ? address.getDisplayName() : null,
                address != null ? address.getGovernorate() : null,
                categoryIds,
                categoryNames,
                session != null ? session.getStartAt() : null,
                session != null ? session.getEndAt() : null,
                booking.getNumberOfPeople(),
                booking.getStatus(),
                attendanceSummary(passes),
                reviewEligible(booking, session, existingReview),
                existingReview != null,
                existingReview != null ? existingReview.getId() : null
        );
    }

    private ProfileReviewDto toReviewDto(
            Review review,
            Map<String, ActivityTemplate> templatesById,
            Map<String, Address> addressesById
    ) {
        ActivityTemplate template = templatesById.get(review.getActivityTemplateId());
        Address address = template != null ? addressesById.get(template.getAddressId()) : null;

        return new ProfileReviewDto(
                review.getId(),
                review.getBookingId(),
                review.getActivityTemplateId(),
                template != null ? template.getTitle() : "Adventure",
                template != null ? coverImage(template) : null,
                address != null ? address.getGovernorate() : null,
                review.getRating(),
                review.getComment(),
                review.getCreatedAt()
        );
    }

    private List<ProfileTopCategoryDto> buildTopCategories(
            List<Booking> completedBookings,
            Map<String, ActivitySession> sessionsById,
            Map<String, ActivityTemplate> templatesById,
            Map<String, Category> categoriesById
    ) {
        Map<String, Integer> counts = new LinkedHashMap<>();

        for (Booking booking : completedBookings) {
            ActivitySession session = sessionsById.get(booking.getSessionId());
            ActivityTemplate template = session != null ? templatesById.get(session.getTemplateId()) : null;
            if (template == null) continue;

            safeList(template.getCategoryIds())
                    .forEach(categoryId -> counts.merge(categoryId, 1, Integer::sum));
        }

        return counts.entrySet()
                .stream()
                .map(entry -> {
                    Category category = categoriesById.get(entry.getKey());
                    return new ProfileTopCategoryDto(
                            entry.getKey(),
                            category != null && category.getName() != null && !category.getName().isBlank()
                                    ? category.getName()
                                    : "Unknown category",
                            entry.getValue()
                    );
                })
                .sorted(Comparator.comparingInt(ProfileTopCategoryDto::count).reversed())
                .limit(5)
                .toList();
    }

    private ProfileTripAttendanceSummaryDto attendanceSummary(List<GuestPass> passes) {
        int cancelled = (int) passes.stream().filter(pass -> pass.getStatus() == GuestPassStatus.CANCELLED).count();
        List<GuestPass> active = passes.stream().filter(pass -> pass.getStatus() == GuestPassStatus.ACTIVE).toList();

        int present = (int) active.stream().filter(pass -> pass.getAttendanceStatus() == AttendanceStatus.PRESENT).count();
        int absent = (int) active.stream().filter(pass -> pass.getAttendanceStatus() == AttendanceStatus.ABSENT).count();
        int notMarked = (int) active.stream().filter(pass -> pass.getAttendanceStatus() == AttendanceStatus.NOT_MARKED).count();

        return new ProfileTripAttendanceSummaryDto(passes.size(), present, absent, notMarked, cancelled);
    }

    private boolean reviewEligible(Booking booking, ActivitySession session, Review existingReview) {
        if (existingReview != null) return false;
        if (booking.getStatus() != BookingStatus.COMPLETED) return false;
        if (booking.isAttendanceMarkedAbsent()) return false;
        return session != null && session.getStartAt() != null && session.getStartAt().isBefore(Instant.now());
    }

    private String templateIdForBooking(Booking booking, Map<String, ActivitySession> sessionsById) {
        ActivitySession session = sessionsById.get(booking.getSessionId());
        return session != null ? session.getTemplateId() : null;
    }

    private String coverImage(ActivityTemplate template) {
        if (template.getImages() == null || template.getImages().isEmpty()) {
            return null;
        }

        return template.getImages()
                .stream()
                .filter(ActivityImage::isCover)
                .findFirst()
                .orElse(template.getImages().get(0))
                .getUrl();
    }

    private List<String> safeList(List<String> value) {
        return value == null ? List.of() : value;
    }

    private Set<String> concat(java.util.stream.Stream<String> first, java.util.stream.Stream<String> second) {
        return java.util.stream.Stream.concat(first, second)
                .filter(Objects::nonNull)
                .collect(Collectors.toCollection(java.util.LinkedHashSet::new));
    }

    private int sanitizePage(int page) {
        return Math.max(0, page);
    }

    private int sanitizeSize(int size) {
        return Math.max(1, Math.min(size <= 0 ? DEFAULT_SIZE : size, 50));
    }
}

package com.untamed.untamedbackend.service;

import com.untamed.untamedbackend.booking.Booking;
import com.untamed.untamedbackend.booking.BookingRepository;
import com.untamed.untamedbackend.booking.BookingStatus;
import com.untamed.untamedbackend.dto.ActivityImageDto;
import com.untamed.untamedbackend.dto.GuideTemplateDashboardTemplateDto;
import com.untamed.untamedbackend.dto.GuideTemplateSessionAttendanceSummaryDto;
import com.untamed.untamedbackend.dto.GuideTemplateSessionBookingSummaryDto;
import com.untamed.untamedbackend.dto.GuideTemplateSessionDashboardDto;
import com.untamed.untamedbackend.dto.GuideTemplateSessionsDashboardResponse;
import com.untamed.untamedbackend.dto.GuideTemplateSessionsSummaryDto;
import com.untamed.untamedbackend.dto.PaginatedResponse;
import com.untamed.untamedbackend.guestpass.AttendanceStatus;
import com.untamed.untamedbackend.guestpass.GuestPass;
import com.untamed.untamedbackend.guestpass.GuestPassRepository;
import com.untamed.untamedbackend.guestpass.GuestPassStatus;
import com.untamed.untamedbackend.model.ActivityImage;
import com.untamed.untamedbackend.model.ActivitySession;
import com.untamed.untamedbackend.model.ActivityStatus;
import com.untamed.untamedbackend.model.ActivityTemplate;
import com.untamed.untamedbackend.model.Address;
import com.untamed.untamedbackend.model.Category;
import com.untamed.untamedbackend.model.Role;
import com.untamed.untamedbackend.model.User;
import com.untamed.untamedbackend.repository.ActivitySessionRepository;
import com.untamed.untamedbackend.repository.ActivityTemplateRepository;
import com.untamed.untamedbackend.repository.AddressRepository;
import com.untamed.untamedbackend.repository.CategoryRepository;
import com.untamed.untamedbackend.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class GuideTemplateSessionsDashboardService {

    private static final int DEFAULT_SIZE = 20;

    private final UserRepository userRepository;
    private final ActivityTemplateRepository templateRepository;
    private final ActivitySessionRepository sessionRepository;
    private final BookingRepository bookingRepository;
    private final GuestPassRepository guestPassRepository;
    private final CategoryRepository categoryRepository;
    private final AddressRepository addressRepository;

    public GuideTemplateSessionsDashboardResponse getDashboard(
            String authEmail,
            String templateId,
            int page,
            int size
    ) {
        User guide = getGuideByEmail(authEmail);
        ActivityTemplate template = templateRepository.findById(templateId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Template not found"));

        if (!Objects.equals(template.getGuideId(), guide.getId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Only the owner guide can access this activity.");
        }

        int safePage = Math.max(0, page);
        int safeSize = sanitizeSize(size);

        Page<ActivitySession> sessionPage = sessionRepository.findByTemplateIdAndGuideId(
                templateId,
                guide.getId(),
                PageRequest.of(safePage, safeSize, Sort.by(Sort.Direction.ASC, "startAt"))
        );
        List<ActivitySession> allSessions =
                sessionRepository.findByTemplateIdAndGuideIdOrderByStartAtAsc(templateId, guide.getId());

        List<String> allSessionIds = allSessions.stream().map(ActivitySession::getId).toList();
        List<Booking> allBookings = allSessionIds.isEmpty()
                ? List.of()
                : bookingRepository.findBySessionIdIn(allSessionIds);
        List<GuestPass> allPasses = allSessionIds.isEmpty()
                ? List.of()
                : guestPassRepository.findBySessionIdIn(allSessionIds);

        Map<String, List<Booking>> bookingsBySessionId = allBookings.stream()
                .collect(Collectors.groupingBy(Booking::getSessionId));
        Map<String, List<GuestPass>> passesBySessionId = allPasses.stream()
                .collect(Collectors.groupingBy(GuestPass::getSessionId));

        List<GuideTemplateSessionDashboardDto> sessions = sessionPage.getContent()
                .stream()
                .map(session -> toSessionDto(
                        session,
                        bookingsBySessionId.getOrDefault(session.getId(), List.of()),
                        passesBySessionId.getOrDefault(session.getId(), List.of())
                ))
                .toList();

        return new GuideTemplateSessionsDashboardResponse(
                toTemplateDto(template),
                PaginatedResponse.from(sessionPage, sessions),
                buildSummary(template, allSessions, allBookings)
        );
    }

    private GuideTemplateDashboardTemplateDto toTemplateDto(ActivityTemplate template) {
        Map<String, Category> categoriesById = safeList(template.getCategoryIds()).isEmpty()
                ? Map.of()
                : categoryRepository.findAllById(template.getCategoryIds())
                        .stream()
                        .collect(Collectors.toMap(Category::getId, Function.identity(), (a, b) -> a));

        Address address = template.getAddressId() == null
                ? null
                : addressRepository.findById(template.getAddressId()).orElse(null);

        List<ActivityImageDto> images = safeList(template.getImages())
                .stream()
                .map(this::toImageDto)
                .toList();

        return new GuideTemplateDashboardTemplateDto(
                template.getId(),
                template.getTitle(),
                template.getDescription(),
                template.getDifficulty(),
                template.getPrice(),
                images,
                coverImageUrl(template),
                safeList(template.getCategoryIds()),
                safeList(template.getCategoryIds())
                        .stream()
                        .map(categoryId -> {
                            Category category = categoriesById.get(categoryId);
                            return category != null && category.getName() != null && !category.getName().isBlank()
                                    ? category.getName()
                                    : "Unknown category";
                        })
                        .toList(),
                template.getAddressId(),
                address != null ? address.getDisplayName() : null,
                address != null ? address.getGovernorate() : null,
                address != null ? address.getLocality() : null,
                template.isArchived(),
                template.getArchivedAt(),
                template.getCreatedAt(),
                template.getUpdatedAt()
        );
    }

    private GuideTemplateSessionDashboardDto toSessionDto(
            ActivitySession session,
            List<Booking> bookings,
            List<GuestPass> passes
    ) {
        return new GuideTemplateSessionDashboardDto(
                session.getId(),
                session.getTemplateId(),
                session.getStartAt(),
                session.getEndAt(),
                session.getCapacity(),
                session.getBookedCount(),
                Math.max(0, session.getCapacity() - session.getBookedCount()),
                session.getStatus(),
                session.getMeetingPoint(),
                session.getSessionNote(),
                session.getCreatedAt(),
                session.getUpdatedAt(),
                buildBookingSummary(bookings),
                buildAttendanceSummary(passes)
        );
    }

    private GuideTemplateSessionBookingSummaryDto buildBookingSummary(List<Booking> bookings) {
        int completed = countBookings(bookings, BookingStatus.COMPLETED);
        int pending = countBookings(bookings, BookingStatus.PENDING);
        int paying = countBookings(bookings, BookingStatus.PAYING);
        int cancelled = countBookings(bookings, BookingStatus.CANCELLED);
        int expired = countBookings(bookings, BookingStatus.EXPIRED);

        return new GuideTemplateSessionBookingSummaryDto(
                bookings.size(),
                completed,
                pending,
                paying,
                cancelled,
                expired,
                participantCount(bookings, List.of(BookingStatus.COMPLETED)),
                participantCount(bookings, List.of(BookingStatus.PENDING, BookingStatus.PAYING, BookingStatus.COMPLETED))
        );
    }

    private GuideTemplateSessionAttendanceSummaryDto buildAttendanceSummary(List<GuestPass> passes) {
        List<GuestPass> activePasses = passes.stream()
                .filter(pass -> pass.getStatus() == GuestPassStatus.ACTIVE)
                .toList();

        return new GuideTemplateSessionAttendanceSummaryDto(
                activePasses.size(),
                countAttendance(activePasses, AttendanceStatus.PRESENT),
                countAttendance(activePasses, AttendanceStatus.ABSENT),
                countAttendance(activePasses, AttendanceStatus.NOT_MARKED)
        );
    }

    private GuideTemplateSessionsSummaryDto buildSummary(
            ActivityTemplate template,
            List<ActivitySession> sessions,
            List<Booking> bookings
    ) {
        Instant now = Instant.now();
        long cancelledSessions = sessions.stream()
                .filter(session -> session.getStatus() == ActivityStatus.CANCELLED)
                .count();
        long completedSessions = sessions.stream()
                .filter(session -> isHistorySession(session, now) && session.getStatus() != ActivityStatus.CANCELLED)
                .count();
        long upcomingSessions = sessions.size() - completedSessions - cancelledSessions;
        int totalParticipants = participantCount(bookings, List.of(
                BookingStatus.PENDING,
                BookingStatus.PAYING,
                BookingStatus.COMPLETED
        ));
        int paidParticipants = participantCount(bookings, List.of(BookingStatus.COMPLETED));
        BigDecimal revenue = template.getPrice() == null
                ? BigDecimal.ZERO
                : template.getPrice().multiply(BigDecimal.valueOf(paidParticipants));

        return new GuideTemplateSessionsSummaryDto(
                sessions.size(),
                Math.max(0, upcomingSessions),
                completedSessions,
                cancelledSessions,
                bookings.size(),
                totalParticipants,
                revenue,
                averageFillRate(sessions)
        );
    }

    private boolean isHistorySession(ActivitySession session, Instant now) {
        return session.getStatus() == ActivityStatus.COMPLETED
                || (session.getEndAt() != null && session.getEndAt().isBefore(now));
    }

    private double averageFillRate(List<ActivitySession> sessions) {
        if (sessions.isEmpty()) {
            return 0.0;
        }

        double average = sessions.stream()
                .filter(session -> session.getCapacity() > 0)
                .mapToDouble(session -> (double) session.getBookedCount() / session.getCapacity())
                .average()
                .orElse(0.0);

        return BigDecimal.valueOf(average * 100)
                .setScale(1, RoundingMode.HALF_UP)
                .doubleValue();
    }

    private int countBookings(List<Booking> bookings, BookingStatus status) {
        return (int) bookings.stream().filter(booking -> booking.getStatus() == status).count();
    }

    private int participantCount(List<Booking> bookings, Collection<BookingStatus> statuses) {
        return bookings.stream()
                .filter(booking -> statuses.contains(booking.getStatus()))
                .mapToInt(Booking::getNumberOfPeople)
                .sum();
    }

    private int countAttendance(List<GuestPass> passes, AttendanceStatus status) {
        return (int) passes.stream().filter(pass -> pass.getAttendanceStatus() == status).count();
    }

    private ActivityImageDto toImageDto(ActivityImage image) {
        return new ActivityImageDto(
                image.getUrl(),
                image.getPublicId(),
                image.getAlt(),
                image.isCover(),
                image.getOrder()
        );
    }

    private String coverImageUrl(ActivityTemplate template) {
        return safeList(template.getImages())
                .stream()
                .filter(ActivityImage::isCover)
                .findFirst()
                .or(() -> safeList(template.getImages()).stream().findFirst())
                .map(ActivityImage::getUrl)
                .orElse(null);
    }

    private User getGuideByEmail(String authEmail) {
        User user = userRepository.findByEmail(authEmail)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));

        if (user.getRole() != Role.GUIDE) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Only GUIDE can access this dashboard.");
        }

        return user;
    }

    private <T> List<T> safeList(List<T> value) {
        return value == null ? List.of() : value;
    }

    private int sanitizeSize(int size) {
        return Math.max(1, Math.min(size <= 0 ? DEFAULT_SIZE : size, 50));
    }
}

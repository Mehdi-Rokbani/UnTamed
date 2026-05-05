package com.untamed.untamedbackend.guestpass;

import com.untamed.untamedbackend.booking.Booking;
import com.untamed.untamedbackend.booking.BookingRepository;
import com.untamed.untamedbackend.booking.BookingStatus;
import com.untamed.untamedbackend.model.ActivitySession;
import com.untamed.untamedbackend.model.ActivityTemplate;
import com.untamed.untamedbackend.model.User;
import com.untamed.untamedbackend.dto.PaginatedResponse;
import com.untamed.untamedbackend.repository.ActivitySessionRepository;
import com.untamed.untamedbackend.repository.ActivityTemplateRepository;
import com.untamed.untamedbackend.repository.UserRepository;
import com.untamed.untamedbackend.service.LevelingService;
import org.springframework.http.HttpStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

@Service
public class GuestPassService {

    private final GuestPassRepository guestPassRepository;
    private final BookingRepository bookingRepository;
    private final ActivitySessionRepository activitySessionRepository;
    private final ActivityTemplateRepository activityTemplateRepository;
    private final UserRepository userRepository;
    private final LevelingService levelingService;

    public GuestPassService(
            GuestPassRepository guestPassRepository,
            BookingRepository bookingRepository,
            ActivitySessionRepository activitySessionRepository,
            ActivityTemplateRepository activityTemplateRepository,
            UserRepository userRepository, LevelingService levelingService
    ) {
        this.guestPassRepository = guestPassRepository;
        this.bookingRepository = bookingRepository;
        this.activitySessionRepository = activitySessionRepository;
        this.activityTemplateRepository = activityTemplateRepository;
        this.userRepository = userRepository;
        this.levelingService = levelingService;
    }

    public List<GuestPassDto> generatePassesForPaidBooking(String bookingId) {
        Booking booking = bookingRepository.findById(bookingId)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND,
                        "Booking not found"
                ));

        if (booking.getStatus() != BookingStatus.COMPLETED) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "Guest passes can only be generated for paid bookings"
            );
        }

        if (guestPassRepository.existsByBookingId(bookingId)) {
            return guestPassRepository.findByBookingId(bookingId)
                    .stream()
                    .map(GuestPassDto::from)
                    .toList();
        }

        ActivitySession session = activitySessionRepository.findById(booking.getSessionId())
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND,
                        "Session not found"
                ));

        ActivityTemplate template = activityTemplateRepository.findById(session.getTemplateId())
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND,
                        "Activity template not found"
                ));

        String sessionId = session.getId();
        String activityTemplateId = template.getId();
        String guideId = template.getGuideId();

        if (sessionId == null || sessionId.isBlank()) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "Session id is missing"
            );
        }

        if (activityTemplateId == null || activityTemplateId.isBlank()) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "Activity template id is missing"
            );
        }

        if (guideId == null || guideId.isBlank()) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "Activity guide id is missing"
            );
        }

        int totalPasses = booking.getNumberOfPeople();

        List<String> guestNames = booking.getGuestNames() == null
                ? List.of()
                : booking.getGuestNames();

        int expectedFriendNames = Math.max(0, totalPasses - 1);

        if (guestNames.size() != expectedFriendNames) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Invalid guest names count for booking"
            );
        }

        String mainBookerName = resolveMainBookerName(booking);

        List<GuestPass> passes = new ArrayList<>();

        passes.add(new GuestPass(
                booking.getId(),
                sessionId,
                activityTemplateId,
                guideId,
                SecureTokenGenerator.generateToken(),
                1,
                totalPasses,
                mainBookerName,
                true
        ));

        for (int i = 0; i < guestNames.size(); i++) {
            passes.add(new GuestPass(
                    booking.getId(),
                    sessionId,
                    activityTemplateId,
                    guideId,
                    SecureTokenGenerator.generateToken(),
                    i + 2,
                    totalPasses,
                    guestNames.get(i),
                    false
            ));
        }

        return guestPassRepository.saveAll(passes)
                .stream()
                .map(GuestPassDto::from)
                .toList();
    }

    public List<GuestPassDto> getPassesForBooking(String bookingId) {
        return guestPassRepository.findByBookingId(bookingId)
                .stream()
                .map(GuestPassDto::from)
                .toList();
    }

    public VerifyGuestPassDto verifyPublicByToken(String token) {
        return buildVerificationResponse(token);
    }

    public VerifyGuestPassDto verifyForGuideByToken(String token, String guideId) {
        GuestPass pass = guestPassRepository.findByToken(token)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND,
                        "Invalid guest pass"
                ));

        validateGuideOwnsPassActivity(pass, guideId);

        return buildVerificationResponse(token);
    }

    public VerifyGuestPassDto verifyByToken(String token) {
        return verifyPublicByToken(token);
    }

    public VerifyGuestPassDto markPresentByToken(String token, String guideId) {
        GuestPass pass = guestPassRepository.findByToken(token)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND,
                        "Invalid guest pass"
                ));

        validateGuideCanMarkAttendance(pass, guideId);

        boolean wasAlreadyPresent = pass.getAttendanceStatus() == AttendanceStatus.PRESENT;

        pass.markPresent(guideId);
        guestPassRepository.save(pass);

        if (!wasAlreadyPresent && pass.getBookingId() != null) {
            bookingRepository.findById(pass.getBookingId()).ifPresent(booking ->
                    levelingService.recalculateUserLevel(booking.getUserId())
            );
        }

        return buildVerificationResponse(token);
    }

    public VerifyGuestPassDto markAbsentByToken(String token, String guideId) {
        GuestPass pass = guestPassRepository.findByToken(token)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND,
                        "Invalid guest pass"
                ));

        validateGuideCanMarkAttendance(pass, guideId);

        boolean wasPresent = pass.getAttendanceStatus() == AttendanceStatus.PRESENT;

        pass.markAbsent(guideId);
        guestPassRepository.save(pass);

        if (wasPresent && pass.getBookingId() != null) {
            bookingRepository.findById(pass.getBookingId()).ifPresent(booking ->
                    levelingService.recalculateUserLevel(booking.getUserId())
            );
        }

        return buildVerificationResponse(token);
    }

    private VerifyGuestPassDto buildVerificationResponse(String token) {
        GuestPass pass = guestPassRepository.findByToken(token)
                .orElse(null);

        if (pass == null) {
            return new VerifyGuestPassDto(
                    false,
                    "Invalid guest pass",
                    null,
                    null,
                    null,
                    null,
                    null,
                    0,
                    0,
                    null,
                    false,
                    null,
                    null,
                    null,
                    null,
                    0,
                    false,
                    false,
                    null,
                    null
            );
        }

        Booking booking = bookingRepository.findById(pass.getBookingId())
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND,
                        "Booking not found"
                ));

        if (booking.getStatus() != BookingStatus.COMPLETED) {
            return new VerifyGuestPassDto(
                    false,
                    "Booking is not paid",
                    pass.getId(),
                    booking.getId(),
                    pass.getSessionId(),
                    pass.getActivityTemplateId(),
                    pass.getGuideId(),
                    pass.getPassNumber(),
                    pass.getTotalPasses(),
                    pass.getGuestName(),
                    pass.isMainBooker(),
                    pass.getStatus(),
                    pass.getAttendanceStatus(),
                    null,
                    null,
                    booking.getNumberOfPeople(),
                    pass.isPresent(),
                    pass.isAbsent(),
                    pass.getMarkedAt(),
                    pass.getMarkedByGuideId()
            );
        }

        ActivitySession session = resolveSessionForPass(pass, booking);
        ActivityTemplate template = resolveTemplateForPass(pass, session);

        String message;

        if (pass.getStatus() == GuestPassStatus.CANCELLED) {
            message = "Guest pass is cancelled";
        } else if (pass.isPresent()) {
            message = "Guest already marked present";
        } else if (pass.isAbsent()) {
            message = "Guest marked absent";
        } else {
            message = "Valid guest pass";
        }

        return new VerifyGuestPassDto(
                pass.getStatus() == GuestPassStatus.ACTIVE,
                message,
                pass.getId(),
                booking.getId(),
                pass.getSessionId() != null ? pass.getSessionId() : session.getId(),
                pass.getActivityTemplateId() != null ? pass.getActivityTemplateId() : template.getId(),
                pass.getGuideId() != null ? pass.getGuideId() : template.getGuideId(),
                pass.getPassNumber(),
                pass.getTotalPasses(),
                pass.getGuestName(),
                pass.isMainBooker(),
                pass.getStatus(),
                pass.getAttendanceStatus(),
                template.getTitle(),
                session.getStartAt(),
                booking.getNumberOfPeople(),
                pass.isPresent(),
                pass.isAbsent(),
                pass.getMarkedAt(),
                pass.getMarkedByGuideId()
        );
    }

    private void validateGuideOwnsPassActivity(GuestPass pass, String guideId) {
        if (guideId == null || guideId.isBlank()) {
            throw new ResponseStatusException(
                    HttpStatus.UNAUTHORIZED,
                    "Guide authentication required"
            );
        }

        String passGuideId = pass.getGuideId();

        if (passGuideId != null && !passGuideId.isBlank()) {
            if (!passGuideId.equals(guideId)) {
                throw new ResponseStatusException(
                        HttpStatus.FORBIDDEN,
                        "Only the guide who created this activity can scan this pass"
                );
            }
            return;
        }

        Booking booking = bookingRepository.findById(pass.getBookingId())
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND,
                        "Booking not found"
                ));

        ActivitySession session = activitySessionRepository.findById(booking.getSessionId())
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND,
                        "Session not found"
                ));

        ActivityTemplate template = activityTemplateRepository.findById(session.getTemplateId())
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND,
                        "Activity template not found"
                ));

        if (template.getGuideId() == null || !template.getGuideId().equals(guideId)) {
            throw new ResponseStatusException(
                    HttpStatus.FORBIDDEN,
                    "Only the guide who created this activity can scan this pass"
            );
        }
    }

    private void validateGuideCanMarkAttendance(GuestPass pass, String guideId) {
        validateGuideOwnsPassActivity(pass, guideId);

        if (pass.getStatus() == GuestPassStatus.CANCELLED) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "Guest pass is cancelled"
            );
        }

        Booking booking = bookingRepository.findById(pass.getBookingId())
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND,
                        "Booking not found"
                ));

        if (booking.getStatus() != BookingStatus.COMPLETED) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "Booking is not paid"
            );
        }

        ActivitySession session = resolveSessionForPass(pass, booking);

        if (session.getStartAt() == null) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "Session start time is missing"
            );
        }

        if (Instant.now().isBefore(session.getStartAt())) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "Check-in is only allowed after the activity starts"
            );
        }
    }

    private ActivitySession resolveSessionForPass(GuestPass pass, Booking booking) {
        String sessionId = pass.getSessionId();

        if (sessionId == null || sessionId.isBlank()) {
            sessionId = booking.getSessionId();
        }

        return activitySessionRepository.findById(sessionId)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND,
                        "Session not found"
                ));
    }

    private ActivityTemplate resolveTemplateForPass(GuestPass pass, ActivitySession session) {
        String activityTemplateId = pass.getActivityTemplateId();

        if (activityTemplateId == null || activityTemplateId.isBlank()) {
            activityTemplateId = session.getTemplateId();
        }

        return activityTemplateRepository.findById(activityTemplateId)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND,
                        "Activity template not found"
                ));
    }

    private String resolveMainBookerName(Booking booking) {
        User user = userRepository.findById(booking.getUserId()).orElse(null);

        if (user == null) {
            return "Main booker";
        }

        if (user.getUsername() != null && !user.getUsername().isBlank()) {
            return user.getUsername();
        }

        if (user.getEmail() != null && !user.getEmail().isBlank()) {
            return user.getEmail();
        }

        return "Main booker";
    }

    public List<GuideGuestPassAttendanceDto> getSessionAttendanceForGuide(String sessionId, String guideId) {
        ActivitySession session = activitySessionRepository.findById(sessionId)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND,
                        "Session not found"
                ));

        ActivityTemplate template = activityTemplateRepository.findById(session.getTemplateId())
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND,
                        "Activity template not found"
                ));

        if (template.getGuideId() == null || !template.getGuideId().equals(guideId)) {
            throw new ResponseStatusException(
                    HttpStatus.FORBIDDEN,
                    "You can only view attendance for your own activity sessions"
            );
        }

        return guestPassRepository.findBySessionIdOrderByPassNumberAsc(sessionId)
                .stream()
                .map(pass -> toGuideAttendanceDto(pass, session, template))
                .toList();
    }

    public List<GuideGuestPassAttendanceDto> getGuideAttendanceHistory(String guideId) {
        return guestPassRepository.findByGuideIdOrderByCreatedAtDesc(guideId)
                .stream()
                .map(this::toGuideAttendanceDto)
                .toList();
    }

    public PaginatedResponse<GuideGuestPassAttendanceDto> getGuideAttendanceHistoryPage(String guideId, int page, int size) {
        Page<GuestPass> passPage = guestPassRepository.findByGuideId(
                guideId,
                PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "createdAt"))
        );

        List<GuideGuestPassAttendanceDto> content = passPage.getContent()
                .stream()
                .map(this::toGuideAttendanceDto)
                .toList();

        return PaginatedResponse.from(passPage, content);
    }

    private GuideGuestPassAttendanceDto toGuideAttendanceDto(GuestPass pass) {
        Booking booking = bookingRepository.findById(pass.getBookingId())
                .orElse(null);

        ActivitySession session = null;
        ActivityTemplate template = null;

        if (booking != null) {
            session = resolveSessionForPass(pass, booking);
            template = resolveTemplateForPass(pass, session);
        } else if (pass.getSessionId() != null && !pass.getSessionId().isBlank()) {
            session = activitySessionRepository.findById(pass.getSessionId()).orElse(null);

            if (session != null) {
                template = resolveTemplateForPass(pass, session);
            }
        }

        return toGuideAttendanceDto(pass, session, template);
    }

    private GuideGuestPassAttendanceDto toGuideAttendanceDto(
            GuestPass pass,
            ActivitySession session,
            ActivityTemplate template
    ) {
        return new GuideGuestPassAttendanceDto(
                pass.getId(),

                pass.getBookingId(),
                pass.getSessionId(),
                pass.getActivityTemplateId(),
                pass.getGuideId(),

                pass.getGuestName(),
                pass.isMainBooker(),

                pass.getPassNumber(),
                pass.getTotalPasses(),

                pass.getStatus(),
                pass.getAttendanceStatus(),

                template != null ? template.getTitle() : null,
                session != null ? session.getStartAt() : null,

                pass.getCreatedAt(),
                pass.getMarkedAt(),
                pass.getMarkedByGuideId()
        );
    }
}

package com.untamed.untamedbackend.admin;

import com.untamed.untamedbackend.booking.BookingRepository;
import com.untamed.untamedbackend.booking.BookingStatus;
import com.untamed.untamedbackend.booking.CancelledBy;
import com.untamed.untamedbackend.booking.RefundStatus;
import com.untamed.untamedbackend.booking.SessionSeatOps;
import com.untamed.untamedbackend.chat.ChatService;
import com.untamed.untamedbackend.dto.PaginatedResponse;
import com.untamed.untamedbackend.guestpass.GuestPass;
import com.untamed.untamedbackend.guestpass.GuestPassRepository;
import com.untamed.untamedbackend.model.Address;
import com.untamed.untamedbackend.model.ActivitySession;
import com.untamed.untamedbackend.model.ActivityStatus;
import com.untamed.untamedbackend.model.ActivityTemplate;
import com.untamed.untamedbackend.model.Category;
import com.untamed.untamedbackend.model.Role;
import com.untamed.untamedbackend.model.User;
import com.untamed.untamedbackend.notification.NotificationService;
import com.untamed.untamedbackend.notification.NotificationSeverity;
import com.untamed.untamedbackend.notification.NotificationType;
import com.untamed.untamedbackend.payment.PaymentAttemptRepository;
import com.untamed.untamedbackend.payment.PaymentAttemptStatus;
import com.untamed.untamedbackend.payment.PaymentAttempt;
import com.untamed.untamedbackend.payment.PaymentProvider;
import com.untamed.untamedbackend.payment.stripe.StripeRefundService;
import com.untamed.untamedbackend.repository.ActivitySessionRepository;
import com.untamed.untamedbackend.repository.ActivityTemplateRepository;
import com.untamed.untamedbackend.repository.AddressRepository;
import com.untamed.untamedbackend.repository.CategoryRepository;
import com.untamed.untamedbackend.repository.UserRepository;
import com.untamed.untamedbackend.security.AuthenticatedUser;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.function.Function;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

@Service
public class AdminService {

    private static final String GUIDE_VERIFIED_BADGE_FIELD = "guideProfile.verifiedBadge";

    private final UserRepository userRepository;
    private final ActivityTemplateRepository activityTemplateRepository;
    private final ActivitySessionRepository activitySessionRepository;
    private final CategoryRepository categoryRepository;
    private final AddressRepository addressRepository;
    private final BookingRepository bookingRepository;
    private final PaymentAttemptRepository paymentAttemptRepository;
    private final SessionSeatOps sessionSeatOps;
    private final GuestPassRepository guestPassRepository;
    private final ChatService chatService;
    private final StripeRefundService stripeRefundService;
    private final AdminAuditLogService auditLogService;
    private final AdminAlertRepository adminAlertRepository;
    private final NotificationService notificationService;
    private final MongoTemplate mongoTemplate;

    public AdminService(
            UserRepository userRepository,
            ActivityTemplateRepository activityTemplateRepository,
            ActivitySessionRepository activitySessionRepository,
            CategoryRepository categoryRepository,
            AddressRepository addressRepository,
            BookingRepository bookingRepository,
            PaymentAttemptRepository paymentAttemptRepository,
            SessionSeatOps sessionSeatOps,
            GuestPassRepository guestPassRepository,
            ChatService chatService,
            StripeRefundService stripeRefundService,
            AdminAuditLogService auditLogService,
            AdminAlertRepository adminAlertRepository,
            NotificationService notificationService,
            MongoTemplate mongoTemplate
    ) {
        this.userRepository = userRepository;
        this.activityTemplateRepository = activityTemplateRepository;
        this.activitySessionRepository = activitySessionRepository;
        this.categoryRepository = categoryRepository;
        this.addressRepository = addressRepository;
        this.bookingRepository = bookingRepository;
        this.paymentAttemptRepository = paymentAttemptRepository;
        this.sessionSeatOps = sessionSeatOps;
        this.guestPassRepository = guestPassRepository;
        this.chatService = chatService;
        this.stripeRefundService = stripeRefundService;
        this.auditLogService = auditLogService;
        this.adminAlertRepository = adminAlertRepository;
        this.notificationService = notificationService;
        this.mongoTemplate = mongoTemplate;
    }

    public AdminStatsResponse getStats() {
        long totalAdventurers = userRepository.countByRole(Role.ADVENTURER) + userRepository.countByRole(Role.USER);
        long totalGuides = userRepository.countByRole(Role.GUIDE);

        return new AdminStatsResponse(
                userRepository.count(),
                totalAdventurers,
                totalGuides,
                countUnverifiedGuideBadges(),
                activityTemplateRepository.count(),
                activityTemplateRepository.countByArchivedFalse(),
                activitySessionRepository.count(),
                activitySessionRepository.countByStatus(ActivityStatus.PUBLISHED),
                bookingRepository.count(),
                bookingRepository.countByStatus(BookingStatus.COMPLETED),
                calculateTotalRevenue(),
                0L // TODO: replace when review moderation/pending review status exists.
        );
    }

    public AdminOverviewResponse getOverview() {
        var allUsers = userRepository.findAllByOrderByCreatedAtDesc();
        var allBookings = bookingRepository.findAll();
        var allSessions = activitySessionRepository.findAll();
        var allActivities = activityTemplateRepository.findAll();
        var successfulPayments = paymentAttemptRepository.findByStatus(PaymentAttemptStatus.SUCCEEDED);

        var pendingGuideItems = findUnverifiedGuideBadges(5)
                .stream()
                .map(guide -> new AdminOverviewResponse.PendingGuide(
                        guide.getId(),
                        guide.getUsername(),
                        guide.getEmail(),
                        guide.getCreatedAt()
                ))
                .toList();

        var refundReviewBookings = bookingRepository.findByRefundStatusInOrderByCancelledAtDesc(
                List.of(RefundStatus.REFUND_PENDING, RefundStatus.REFUND_FAILED)
        );

        var pendingRefundItems = refundReviewBookings
                .stream()
                .limit(5)
                .map(booking -> {
                    AdminRefundItemResponse item = toRefundItemResponse(booking, null);
                    return new AdminOverviewResponse.PendingRefund(
                            item.bookingId(),
                            item.userEmail(),
                            item.activityTitle(),
                            item.refundAmount(),
                            item.refundStatus()
                    );
                })
                .toList();

        return new AdminOverviewResponse(
                new AdminOverviewResponse.Stats(
                        userRepository.count(),
                        userRepository.countByRole(Role.ADVENTURER) + userRepository.countByRole(Role.USER),
                        userRepository.countByRole(Role.GUIDE),
                        countUnverifiedGuideBadges(),
                        userRepository.countByRoleAndSuspendedTrue(Role.GUIDE),
                        activityTemplateRepository.count(),
                        activitySessionRepository.count(),
                        activitySessionRepository.countByStatus(ActivityStatus.CANCELLED),
                        bookingRepository.count(),
                        bookingRepository.countByStatus(BookingStatus.COMPLETED),
                        bookingRepository.countByRefundStatus(RefundStatus.REFUND_PENDING),
                        bookingRepository.countByRefundStatus(RefundStatus.REFUND_FAILED),
                        countAlertsByStatus(AdminAlertStatus.OPEN),
                        calculateTotalRevenue()
                ),
                buildTrendBuckets(allUsers, allBookings, successfulPayments),
                buildModerationPriorities(),
                refundReviewBookings.stream()
                        .limit(5)
                        .map(this::toRefundAlert)
                        .toList(),
                allSessions.stream()
                        .filter(session -> session.getStatus() == ActivityStatus.CANCELLED)
                        .sorted(Comparator.comparing(
                                ActivitySession::getCancelledAt,
                                Comparator.nullsLast(Comparator.reverseOrder())
                        ))
                        .limit(5)
                        .map(session -> toSessionAlert(session, allBookings))
                        .toList(),
                buildAlertStatusBuckets(),
                allUsers.stream()
                        .limit(5)
                        .map(user -> new AdminOverviewResponse.RecentUser(
                                user.getId(),
                                user.getUsername(),
                                user.getEmail(),
                                user.getRole() == null ? null : user.getRole().name(),
                                user.getProfileImageUrl(),
                                deriveUserStatus(user),
                                user.getCreatedAt()
                        ))
                        .toList(),
                allActivities.stream()
                        .sorted(Comparator.comparing(
                                ActivityTemplate::getCreatedAt,
                                Comparator.nullsLast(Comparator.reverseOrder())
                        ))
                        .limit(5)
                        .map(activity -> {
                            User guide = userRepository.findById(activity.getGuideId()).orElse(null);
                            return new AdminOverviewResponse.RecentActivity(
                                    activity.getId(),
                                    activity.getTitle(),
                                    guide == null ? "Unknown guide" : guide.getUsername(),
                                    coverImageUrl(activity),
                                    activity.isArchived() ? "DISABLED" : "PUBLISHED",
                                    activity.getCreatedAt()
                            );
                        })
                        .toList(),
                allSessions.stream()
                        .sorted(Comparator.comparing(
                                ActivitySession::getStartAt,
                                Comparator.nullsLast(Comparator.reverseOrder())
                        ))
                        .limit(5)
                        .map(this::toRecentSession)
                        .toList(),
                pendingGuideItems,
                pendingRefundItems,
                auditLogService.listRecentOverviewLogs(6)
        );
    }

    private List<AdminOverviewResponse.TrendBucket> buildTrendBuckets(
            List<User> users,
            List<com.untamed.untamedbackend.booking.Booking> bookings,
            List<PaymentAttempt> successfulPayments
    ) {
        LocalDate today = LocalDate.now(ZoneOffset.UTC);

        return java.util.stream.IntStream.rangeClosed(0, 6)
                .mapToObj(offset -> {
                    LocalDate day = today.minusDays(6L - offset);
                    long newUsers = users.stream()
                            .filter(user -> isSameUtcDay(user.getCreatedAt(), day))
                            .count();
                    long newBookings = bookings.stream()
                            .filter(booking -> isSameUtcDay(booking.getCreatedAt(), day))
                            .count();
                    double revenue = successfulPayments.stream()
                            .filter(payment -> isSameUtcDay(payment.getCreatedAt(), day))
                            .mapToInt(payment -> Math.max(0, payment.getAmount()))
                            .mapToDouble(this::toMajorAmount)
                            .sum();

                    return new AdminOverviewResponse.TrendBucket(
                            day.toString(),
                            newUsers,
                            newBookings,
                            revenue
                    );
                })
                .toList();
    }

    private List<AdminOverviewResponse.ModerationPriority> buildModerationPriorities() {
        long pendingGuides = countUnverifiedGuideBadges();
        long suspendedGuides = userRepository.countByRoleAndSuspendedTrue(Role.GUIDE);
        long pendingRefunds = bookingRepository.countByRefundStatus(RefundStatus.REFUND_PENDING);
        long failedRefunds = bookingRepository.countByRefundStatus(RefundStatus.REFUND_FAILED);
        long cancelledSessions = activitySessionRepository.countByStatus(ActivityStatus.CANCELLED);
        long disabledActivities = Math.max(0, activityTemplateRepository.count() - activityTemplateRepository.countByArchivedFalse());

        return List.of(
                new AdminOverviewResponse.ModerationPriority(
                        "PENDING_GUIDES",
                        "Guide verification",
                        "Unverified guide accounts waiting for the verified badge.",
                        pendingGuides,
                        pendingGuides > 0 ? "HIGH" : "CLEAR",
                        "/admin/guides?status=PENDING_VERIFICATION"
                ),
                new AdminOverviewResponse.ModerationPriority(
                        "FAILED_REFUNDS",
                        "Failed refunds",
                        "Refund attempts that need manual review.",
                        failedRefunds,
                        failedRefunds > 0 ? "HIGH" : "CLEAR",
                        "/admin/refunds"
                ),
                new AdminOverviewResponse.ModerationPriority(
                        "PENDING_REFUNDS",
                        "Pending refunds",
                        "Cancelled paid bookings waiting for refund processing.",
                        pendingRefunds,
                        pendingRefunds > 0 ? "HIGH" : "CLEAR",
                        "/admin/refunds"
                ),
                new AdminOverviewResponse.ModerationPriority(
                        "CANCELLED_SESSIONS",
                        "Cancelled sessions",
                        "Cancelled sessions that may have affected bookings.",
                        cancelledSessions,
                        cancelledSessions > 0 ? "MEDIUM" : "CLEAR",
                        "/admin/sessions?status=CANCELLED"
                ),
                new AdminOverviewResponse.ModerationPriority(
                        "SUSPENDED_GUIDES",
                        "Suspended guides",
                        "Guides currently blocked from guide privileges.",
                        suspendedGuides,
                        suspendedGuides > 0 ? "MEDIUM" : "CLEAR",
                        "/admin/guides?status=SUSPENDED"
                ),
                new AdminOverviewResponse.ModerationPriority(
                        "DISABLED_ACTIVITIES",
                        "Disabled activities",
                        "Activities hidden from public booking.",
                        disabledActivities,
                        disabledActivities > 0 ? "LOW" : "CLEAR",
                        "/admin/activities?status=DISABLED"
                )
        );
    }

    private AdminOverviewResponse.RefundAlert toRefundAlert(com.untamed.untamedbackend.booking.Booking booking) {
        AdminRefundItemResponse item = toRefundItemResponse(booking, null);

        return new AdminOverviewResponse.RefundAlert(
                item.bookingId(),
                item.userEmail(),
                item.activityTitle(),
                item.sessionDate(),
                item.refundAmount(),
                item.refundStatus(),
                item.cancelledAt(),
                item.cancelReason(),
                item.paymentIntentId()
        );
    }

    private AdminOverviewResponse.SessionAlert toSessionAlert(
            ActivitySession session,
            List<com.untamed.untamedbackend.booking.Booking> bookings
    ) {
        ActivityTemplate template = activityTemplateRepository.findById(session.getTemplateId()).orElse(null);
        User guide = userRepository.findById(session.getGuideId()).orElse(null);
        long payingNeedsReview = bookings.stream()
                .filter(booking -> session.getId().equals(booking.getSessionId()))
                .filter(booking -> booking.getStatus() == BookingStatus.PAYING)
                .count();
        long paidNeedsRefund = bookings.stream()
                .filter(booking -> session.getId().equals(booking.getSessionId()))
                .filter(booking -> booking.getRefundStatus() == RefundStatus.REFUND_PENDING || booking.getRefundStatus() == RefundStatus.REFUND_FAILED)
                .count();

        return new AdminOverviewResponse.SessionAlert(
                session.getId(),
                template == null ? "Unknown activity" : template.getTitle(),
                guide == null ? "Unknown guide" : guide.getUsername(),
                session.getStartAt(),
                session.getStatus() == null ? null : session.getStatus().name(),
                session.getCancelledAt(),
                session.getCancelledBy(),
                session.getCancellationReason(),
                payingNeedsReview,
                paidNeedsRefund
        );
    }

    private AdminOverviewResponse.RecentSession toRecentSession(ActivitySession session) {
        ActivityTemplate template = activityTemplateRepository.findById(session.getTemplateId()).orElse(null);
        User guide = userRepository.findById(session.getGuideId()).orElse(null);

        return new AdminOverviewResponse.RecentSession(
                session.getId(),
                template == null ? "Unknown activity" : template.getTitle(),
                guide == null ? "Unknown guide" : guide.getUsername(),
                session.getStartAt(),
                session.getStatus() == null ? null : session.getStatus().name(),
                session.getBookedCount(),
                session.getCapacity()
        );
    }

    private boolean isSameUtcDay(Instant value, LocalDate day) {
        return value != null && value.atZone(ZoneOffset.UTC).toLocalDate().equals(day);
    }

    private long countUnverifiedGuideBadges() {
        return mongoTemplate.count(unverifiedGuideBadgeQuery(), User.class);
    }

    private List<User> findUnverifiedGuideBadges(int limit) {
        Query query = unverifiedGuideBadgeQuery()
                .with(Sort.by(Sort.Direction.DESC, "createdAt"));
        if (limit > 0) {
            query.limit(limit);
        }
        return mongoTemplate.find(query, User.class);
    }

    private Query unverifiedGuideBadgeQuery() {
        Query query = new Query();
        query.addCriteria(new Criteria().andOperator(
                Criteria.where("role").is(Role.GUIDE),
                Criteria.where(GUIDE_VERIFIED_BADGE_FIELD).is(false)
        ));
        return query;
    }

    private boolean hasVerifiedGuideBadge(User user) {
        return user != null
                && user.getGuideProfile() != null
                && Boolean.TRUE.equals(user.getGuideProfile().getVerifiedBadge());
    }

    public PaginatedResponse<AdminAlertResponse> getAlertsPage(
            int page,
            int size,
            String query,
            String type,
            String severity,
            String status
    ) {
        int safePage = safePage(page);
        int safeSize = safeSize(size);
        String cleanStatus = trimToNull(status);
        if (cleanStatus != null
                && !"ALL".equalsIgnoreCase(cleanStatus)
                && !"OPEN".equalsIgnoreCase(cleanStatus)
                && !"ACKNOWLEDGED".equalsIgnoreCase(cleanStatus)
                && !"RESOLVED".equalsIgnoreCase(cleanStatus)) {
            return PaginatedResponse.of(List.of(), safePage, safeSize, 0);
        }

        String cleanType = trimToNull(type);
        String cleanSeverity = trimToNull(severity);
        String term = trimToNull(query);

        syncComputedAlerts();

        List<AdminAlertResponse> alerts = adminAlertRepository.findAll()
                .stream()
                .map(this::toAlertResponse)
                .filter(alert -> cleanType == null || "ALL".equalsIgnoreCase(cleanType) || alert.type().equalsIgnoreCase(cleanType))
                .filter(alert -> cleanSeverity == null || "ALL".equalsIgnoreCase(cleanSeverity) || alert.severity().equalsIgnoreCase(cleanSeverity))
                .filter(alert -> cleanStatus == null || "ALL".equalsIgnoreCase(cleanStatus) || alert.status().equalsIgnoreCase(cleanStatus))
                .filter(alert -> matchesAlertQuery(alert, term))
                .sorted(this::compareAlerts)
                .toList();

        int from = Math.min(alerts.size(), safePage * safeSize);
        int to = Math.min(alerts.size(), from + safeSize);
        return PaginatedResponse.of(alerts.subList(from, to), safePage, safeSize, alerts.size());
    }

    public AdminAlertResponse acknowledgeAlert(String id, Authentication authentication) {
        User admin = requireAdmin(authentication);
        AdminAlert alert = requireAlert(id);
        Instant now = Instant.now();
        alert.setStatus(AdminAlertStatus.ACKNOWLEDGED);
        alert.setAcknowledgedAt(now);
        alert.setAcknowledgedByAdminId(admin.getId());
        alert.setAcknowledgedByAdminEmail(admin.getEmail());
        alert.setUpdatedAt(now);
        return toAlertResponse(adminAlertRepository.save(alert));
    }

    public AdminAlertResponse resolveAlert(String id, Authentication authentication) {
        User admin = requireAdmin(authentication);
        AdminAlert alert = requireAlert(id);
        Instant now = Instant.now();
        alert.setStatus(AdminAlertStatus.RESOLVED);
        alert.setResolvedAt(now);
        alert.setResolvedByAdminId(admin.getId());
        alert.setResolvedByAdminEmail(admin.getEmail());
        alert.setUpdatedAt(now);
        return toAlertResponse(adminAlertRepository.save(alert));
    }

    public AdminAlertResponse reopenAlert(String id, Authentication authentication) {
        User admin = requireAdmin(authentication);
        AdminAlert alert = requireAlert(id);
        Instant now = Instant.now();
        alert.setStatus(AdminAlertStatus.OPEN);
        alert.setAcknowledgedAt(null);
        alert.setAcknowledgedByAdminId(null);
        alert.setAcknowledgedByAdminEmail(null);
        alert.setResolvedAt(null);
        alert.setResolvedByAdminId(null);
        alert.setResolvedByAdminEmail(null);
        alert.setUpdatedAt(now);
        return toAlertResponse(adminAlertRepository.save(alert));
    }

    private void syncComputedAlerts() {
        List<AdminAlertResponse> computedAlerts = buildComputedAlerts();
        Set<String> activeIds = computedAlerts.stream()
                .map(AdminAlertResponse::id)
                .collect(Collectors.toSet());
        Map<String, AdminAlert> existingById = adminAlertRepository.findAllById(activeIds)
                .stream()
                .collect(Collectors.toMap(AdminAlert::getId, Function.identity()));
        Instant now = Instant.now();

        List<AdminAlert> upserts = computedAlerts.stream()
                .map(alert -> mergeComputedAlert(alert, existingById.get(alert.id()), now))
                .toList();
        if (!upserts.isEmpty()) {
            adminAlertRepository.saveAll(upserts);
        }

        List<AdminAlert> staleAlerts = adminAlertRepository.findAll()
                .stream()
                .filter(alert -> !activeIds.contains(alert.getId()))
                .filter(alert -> alert.getStatus() != AdminAlertStatus.RESOLVED)
                .peek(alert -> {
                    alert.setStatus(AdminAlertStatus.RESOLVED);
                    alert.setResolvedAt(now);
                    alert.setResolvedByAdminEmail("system");
                    alert.setUpdatedAt(now);
                })
                .toList();
        if (!staleAlerts.isEmpty()) {
            adminAlertRepository.saveAll(staleAlerts);
        }
    }

    private AdminAlert mergeComputedAlert(AdminAlertResponse computed, AdminAlert existing, Instant now) {
        AdminAlert alert = existing == null
                ? AdminAlert.builder()
                        .id(computed.id())
                        .status(AdminAlertStatus.OPEN)
                        .createdAt(computed.createdAt() == null ? now : computed.createdAt())
                        .build()
                : existing;

        alert.setType(computed.type());
        alert.setSeverity(computed.severity());
        alert.setTitle(computed.title());
        alert.setDescription(computed.description());
        alert.setEntityType(computed.entityType());
        alert.setEntityId(computed.entityId());
        alert.setRoute(computed.route());
        if (alert.getCreatedAt() == null) {
            alert.setCreatedAt(computed.createdAt() == null ? now : computed.createdAt());
        }
        alert.setUpdatedAt(now);
        return alert;
    }

    private AdminAlert requireAlert(String id) {
        return adminAlertRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Admin alert not found"));
    }

    private AdminAlertResponse toAlertResponse(AdminAlert alert) {
        return new AdminAlertResponse(
                alert.getId(),
                alert.getType(),
                alert.getSeverity(),
                alert.getTitle(),
                alert.getDescription(),
                alert.getEntityType(),
                alert.getEntityId(),
                alert.getRoute(),
                alert.getStatus() == null ? AdminAlertStatus.OPEN.name() : alert.getStatus().name(),
                alert.getCreatedAt()
        );
    }

    private List<AdminAlertResponse> buildComputedAlerts() {
        List<com.untamed.untamedbackend.booking.Booking> refundBookings = bookingRepository.findByRefundStatusInOrderByCancelledAtDesc(
                List.of(RefundStatus.REFUND_PENDING, RefundStatus.REFUND_FAILED)
        );
        List<com.untamed.untamedbackend.booking.Booking> allBookings = bookingRepository.findAll();
        List<AdminAlertResponse> alerts = new ArrayList<>();

        findUnverifiedGuideBadges(0)
                .stream()
                .forEach(guide -> alerts.add(new AdminAlertResponse(
                        "guide-pending-" + guide.getId(),
                        "PENDING_GUIDE",
                        "WARNING",
                        "Guide verification needed",
                        displayUser(guide) + " needs the verified badge.",
                        "GUIDE",
                        guide.getId(),
                        "/admin/guides?status=PENDING_VERIFICATION",
                        "OPEN",
                        guide.getCreatedAt()
                )));

        userRepository.findByRoleOrderByCreatedAtDesc(Role.GUIDE)
                .stream()
                .filter(User::isSuspended)
                .forEach(guide -> alerts.add(new AdminAlertResponse(
                        "guide-suspended-" + guide.getId(),
                        "SUSPENDED_GUIDE",
                        "CRITICAL",
                        "Suspended guide",
                        displayUser(guide) + " is blocked from guide privileges.",
                        "GUIDE",
                        guide.getId(),
                        "/admin/guides?status=SUSPENDED",
                        "OPEN",
                        guide.getCreatedAt()
                )));

        refundBookings.forEach(booking -> {
            AdminRefundItemResponse item = toRefundItemResponse(booking, null);
            boolean failed = booking.getRefundStatus() == RefundStatus.REFUND_FAILED;
            alerts.add(new AdminAlertResponse(
                    "refund-" + booking.getId(),
                    failed ? "FAILED_REFUND" : "PENDING_REFUND",
                    failed ? "CRITICAL" : "WARNING",
                    failed ? "Refund failed" : "Refund pending",
                    item.activityTitle() + " refund for " + item.userEmail() + " needs admin follow-up.",
                    "REFUND",
                    booking.getId(),
                    "/admin/refunds",
                    "OPEN",
                    booking.getCancelledAt() == null ? booking.getUpdatedAt() : booking.getCancelledAt()
            ));
        });

        activitySessionRepository.findByStatus(ActivityStatus.CANCELLED)
                .forEach(session -> {
                    ActivityTemplate template = activityTemplateRepository.findById(session.getTemplateId()).orElse(null);
                    long payingNeedsReview = allBookings.stream()
                            .filter(booking -> session.getId().equals(booking.getSessionId()))
                            .filter(booking -> booking.getStatus() == BookingStatus.PAYING)
                            .count();
                    long paidNeedsRefund = allBookings.stream()
                            .filter(booking -> session.getId().equals(booking.getSessionId()))
                            .filter(booking -> booking.getRefundStatus() == RefundStatus.REFUND_PENDING || booking.getRefundStatus() == RefundStatus.REFUND_FAILED)
                            .count();
                    alerts.add(new AdminAlertResponse(
                            "session-cancelled-" + session.getId(),
                            "CANCELLED_SESSION",
                            paidNeedsRefund > 0 ? "CRITICAL" : "WARNING",
                            "Cancelled session review",
                            (template == null ? "Unknown activity" : template.getTitle()) + " has " + paidNeedsRefund + " refunds and " + payingNeedsReview + " payments to review.",
                            "SESSION",
                            session.getId(),
                            "/admin/sessions?status=CANCELLED",
                            "OPEN",
                            session.getCancelledAt() == null ? session.getUpdatedAt() : session.getCancelledAt()
                    ));
                });

        activityTemplateRepository.findAll()
                .stream()
                .filter(ActivityTemplate::isArchived)
                .forEach(template -> alerts.add(new AdminAlertResponse(
                        "activity-disabled-" + template.getId(),
                        "DISABLED_ACTIVITY",
                        "INFO",
                        "Disabled activity",
                        template.getTitle() + " is hidden from public booking.",
                        "ACTIVITY",
                        template.getId(),
                        "/admin/activities?status=DISABLED",
                        "OPEN",
                        template.getArchivedAt() == null ? template.getUpdatedAt() : template.getArchivedAt()
                )));

        return alerts;
    }

    private boolean matchesAlertQuery(AdminAlertResponse alert, String term) {
        if (term == null) return true;
        String haystack = String.join(" ",
                nullToEmpty(alert.type()),
                nullToEmpty(alert.severity()),
                nullToEmpty(alert.title()),
                nullToEmpty(alert.description()),
                nullToEmpty(alert.entityType()),
                nullToEmpty(alert.entityId())
        ).toLowerCase();
        return haystack.contains(term.toLowerCase());
    }

    private int compareAlerts(AdminAlertResponse left, AdminAlertResponse right) {
        int severityCompare = Integer.compare(alertSeverityRank(left.severity()), alertSeverityRank(right.severity()));
        if (severityCompare != 0) return severityCompare;
        Instant leftCreatedAt = left.createdAt();
        Instant rightCreatedAt = right.createdAt();
        if (leftCreatedAt == null && rightCreatedAt == null) return 0;
        if (leftCreatedAt == null) return 1;
        if (rightCreatedAt == null) return -1;
        return rightCreatedAt.compareTo(leftCreatedAt);
    }

    private int alertSeverityRank(String severity) {
        return switch (severity == null ? "" : severity.toUpperCase()) {
            case "CRITICAL" -> 0;
            case "WARNING" -> 1;
            default -> 2;
        };
    }

    private String displayUser(User user) {
        if (user.getUsername() != null && !user.getUsername().isBlank()) return user.getUsername();
        return user.getEmail() == null ? "Unknown user" : user.getEmail();
    }

    private String nullToEmpty(String value) {
        return value == null ? "" : value;
    }

    public List<AdminUserResponse> getUsers() {
        return userRepository.findAllByOrderByCreatedAtDesc()
                .stream()
                .map(this::toUserResponse)
                .toList();
    }

    public PaginatedResponse<AdminUserResponse> getUsersPage(
            int page,
            int size,
            String query,
            String role,
            String status
    ) {
        int safePage = safePage(page);
        int safeSize = safeSize(size);
        List<Criteria> criteria = new ArrayList<>();
        String term = trimToNull(query);

        if (term != null) {
            Pattern pattern = containsPattern(term);
            criteria.add(new Criteria().orOperator(
                    Criteria.where("username").regex(pattern),
                    Criteria.where("email").regex(pattern)
            ));
        }

        Role parsedRole = parseRole(role);
        if (parsedRole != null) {
            criteria.add(Criteria.where("role").is(parsedRole));
        }

        Criteria statusCriteria = userStatusCriteria(status);
        if (statusCriteria != null) {
            criteria.add(statusCriteria);
        }

        Query baseQuery = queryFrom(criteria);
        long total = mongoTemplate.count(baseQuery, User.class);
        List<AdminUserResponse> content = mongoTemplate.find(
                        Query.of(baseQuery)
                                .with(PageRequest.of(safePage, safeSize))
                                .with(Sort.by(Sort.Direction.DESC, "createdAt")),
                        User.class
                )
                .stream()
                .map(this::toUserResponse)
                .toList();

        return PaginatedResponse.of(content, safePage, safeSize, total);
    }

    public AdminUserResponse suspendUser(String id, Authentication authentication) {
        User admin = requireAdmin(authentication);
        User target = requireUserForAccountAction(id);

        assertCanManageUser(admin, target);

        target.setSuspended(true);
        target.setEnabled(false);
        User saved = userRepository.save(target);

        auditLogService.logAction(
                admin,
                AdminAuditAction.SUSPEND_USER,
                AdminAuditTargetType.USER,
                saved.getId(),
                saved.getUsername(),
                "Admin suspended user",
                "email=" + saved.getEmail() + ", role=" + saved.getRole()
        );

        return toUserResponse(saved);
    }

    public AdminUserResponse reactivateUser(String id, Authentication authentication) {
        User admin = requireAdmin(authentication);
        User target = requireUserForAccountAction(id);

        assertCanManageUser(admin, target);

        target.setSuspended(false);
        target.setEnabled(true);
        User saved = userRepository.save(target);

        auditLogService.logAction(
                admin,
                AdminAuditAction.REACTIVATE_USER,
                AdminAuditTargetType.USER,
                saved.getId(),
                saved.getUsername(),
                "Admin reactivated user",
                "email=" + saved.getEmail() + ", role=" + saved.getRole() + ", verified=" + saved.isVerified()
        );

        return toUserResponse(saved);
    }

    public List<AdminGuideResponse> getGuides() {
        return userRepository.findByRoleOrderByCreatedAtDesc(Role.GUIDE)
                .stream()
                .map(this::toGuideResponse)
                .toList();
    }

    public PaginatedResponse<AdminGuideResponse> getGuidesPage(
            int page,
            int size,
            String query,
            String status
    ) {
        int safePage = safePage(page);
        int safeSize = safeSize(size);
        List<Criteria> criteria = new ArrayList<>();
        String term = trimToNull(query);

        criteria.add(Criteria.where("role").is(Role.GUIDE));

        if (term != null) {
            Pattern pattern = containsPattern(term);
            criteria.add(new Criteria().orOperator(
                    Criteria.where("username").regex(pattern),
                    Criteria.where("email").regex(pattern)
            ));
        }

        Criteria statusCriteria = guideStatusCriteria(status);
        if (statusCriteria != null) {
            criteria.add(statusCriteria);
        }

        Query baseQuery = queryFrom(criteria);
        long total = mongoTemplate.count(baseQuery, User.class);
        List<AdminGuideResponse> content = mongoTemplate.find(
                        Query.of(baseQuery)
                                .with(PageRequest.of(safePage, safeSize))
                                .with(Sort.by(Sort.Direction.DESC, "createdAt")),
                        User.class
                )
                .stream()
                .map(this::toGuideResponse)
                .toList();

        return PaginatedResponse.of(content, safePage, safeSize, total);
    }

    public AdminGuideSuspensionImpactResponse getGuideSuspensionImpact(String guideId) {
        User guide = requireGuide(guideId);
        var sessions = activitySessionRepository.findByGuideIdAndStartAtAfterOrderByStartAtAsc(
                        guideId,
                        java.time.Instant.now()
                )
                .stream()
                .filter(session -> session.getStatus() != ActivityStatus.CANCELLED)
                .map(this::toSuspensionImpactSession)
                .toList();

        int confirmed = sessions.stream().mapToInt(AdminGuideSuspensionImpactResponse.SessionImpact::confirmedBookingsCount).sum();
        int pending = sessions.stream().mapToInt(AdminGuideSuspensionImpactResponse.SessionImpact::pendingBookingsCount).sum();
        int paying = sessions.stream().mapToInt(AdminGuideSuspensionImpactResponse.SessionImpact::payingBookingsCount).sum();
        double paidAmount = sessions.stream().mapToDouble(AdminGuideSuspensionImpactResponse.SessionImpact::paidAmount).sum();

        return new AdminGuideSuspensionImpactResponse(
                guide.getId(),
                guide.getUsername(),
                guide.getEmail(),
                sessions.size(),
                confirmed,
                pending,
                paying,
                paidAmount,
                sessions
        );
    }

    public List<AdminSessionResponse> getSessions() {
        return activitySessionRepository.findAll()
                .stream()
                .sorted((a, b) -> {
                    if (a.getStartAt() == null && b.getStartAt() == null) return 0;
                    if (a.getStartAt() == null) return 1;
                    if (b.getStartAt() == null) return -1;
                    return b.getStartAt().compareTo(a.getStartAt());
                })
                .map(this::toSessionResponse)
                .toList();
    }

    public PaginatedResponse<AdminSessionResponse> getSessionsPage(
            int page,
            int size,
            String query,
            String status
    ) {
        int safePage = safePage(page);
        int safeSize = safeSize(size);
        List<Criteria> criteria = new ArrayList<>();
        String term = trimToNull(query);

        ActivityStatus parsedStatus = parseActivityStatus(status);
        if (parsedStatus != null) {
            criteria.add(Criteria.where("status").is(parsedStatus));
        }

        if (term != null) {
            Pattern pattern = containsPattern(term);
            List<String> templateIds = mongoTemplate.find(
                            Query.query(Criteria.where("title").regex(pattern)),
                            ActivityTemplate.class
                    )
                    .stream()
                    .map(ActivityTemplate::getId)
                    .toList();
            List<String> guideIds = mongoTemplate.find(
                            Query.query(new Criteria().orOperator(
                                    Criteria.where("username").regex(pattern),
                                    Criteria.where("email").regex(pattern)
                            )),
                            User.class
                    )
                    .stream()
                    .filter(user -> user.getRole() == Role.GUIDE)
                    .map(User::getId)
                    .toList();

            if (templateIds.isEmpty() && guideIds.isEmpty()) {
                criteria.add(Criteria.where("_id").in(Collections.emptyList()));
            } else if (templateIds.isEmpty()) {
                criteria.add(Criteria.where("guide_id").in(guideIds));
            } else if (guideIds.isEmpty()) {
                criteria.add(Criteria.where("template_id").in(templateIds));
            } else {
                criteria.add(new Criteria().orOperator(
                        Criteria.where("template_id").in(templateIds),
                        Criteria.where("guide_id").in(guideIds)
                ));
            }
        }

        Query baseQuery = queryFrom(criteria);
        long total = mongoTemplate.count(baseQuery, ActivitySession.class);
        List<ActivitySession> sessions = mongoTemplate.find(
                Query.of(baseQuery)
                        .with(PageRequest.of(safePage, safeSize))
                        .with(Sort.by(Sort.Direction.DESC, "start_at")),
                ActivitySession.class
        );

        return PaginatedResponse.of(toSessionResponses(sessions), safePage, safeSize, total);
    }

    public List<AdminActivityResponse> getActivities() {
        return activityTemplateRepository.findAll()
                .stream()
                .sorted((a, b) -> {
                    if (a.getCreatedAt() == null && b.getCreatedAt() == null) return 0;
                    if (a.getCreatedAt() == null) return 1;
                    if (b.getCreatedAt() == null) return -1;
                    return b.getCreatedAt().compareTo(a.getCreatedAt());
                })
                .map(this::toActivityResponse)
                .toList();
    }

    public PaginatedResponse<AdminActivityResponse> getActivitiesPage(
            int page,
            int size,
            String query,
            String status,
            String category
    ) {
        int safePage = safePage(page);
        int safeSize = safeSize(size);
        List<Criteria> criteria = new ArrayList<>();
        String term = trimToNull(query);

        Criteria statusCriteria = activityTemplateStatusCriteria(status);
        if (statusCriteria != null) {
            criteria.add(statusCriteria);
        }

        String categoryId = trimToNull(category);
        if (categoryId != null && !"ALL".equalsIgnoreCase(categoryId)) {
            criteria.add(Criteria.where("category_ids").is(categoryId));
        }

        if (term != null) {
            Pattern pattern = containsPattern(term);
            List<Criteria> searchCriteria = new ArrayList<>();
            searchCriteria.add(Criteria.where("title").regex(pattern));

            List<String> categoryIds = mongoTemplate.find(
                            Query.query(Criteria.where("name").regex(pattern)),
                            Category.class
                    )
                    .stream()
                    .map(Category::getId)
                    .toList();
            if (!categoryIds.isEmpty()) {
                searchCriteria.add(Criteria.where("category_ids").in(categoryIds));
            }

            List<String> guideIds = mongoTemplate.find(
                            Query.query(new Criteria().orOperator(
                                    Criteria.where("username").regex(pattern),
                                    Criteria.where("email").regex(pattern)
                            )),
                            User.class
                    )
                    .stream()
                    .filter(user -> user.getRole() == Role.GUIDE)
                    .map(User::getId)
                    .toList();
            if (!guideIds.isEmpty()) {
                searchCriteria.add(Criteria.where("guide_id").in(guideIds));
            }

            List<String> addressIds = mongoTemplate.find(
                            Query.query(new Criteria().orOperator(
                                    Criteria.where("displayName").regex(pattern),
                                    Criteria.where("governorate").regex(pattern),
                                    Criteria.where("delegation").regex(pattern),
                                    Criteria.where("locality").regex(pattern)
                            )),
                            Address.class
                    )
                    .stream()
                    .map(Address::getId)
                    .toList();
            if (!addressIds.isEmpty()) {
                searchCriteria.add(Criteria.where("address_id").in(addressIds));
            }

            criteria.add(new Criteria().orOperator(searchCriteria.toArray(Criteria[]::new)));
        }

        Query baseQuery = queryFrom(criteria);
        long total = mongoTemplate.count(baseQuery, ActivityTemplate.class);
        List<AdminActivityResponse> content = mongoTemplate.find(
                        Query.of(baseQuery)
                                .with(PageRequest.of(safePage, safeSize))
                                .with(Sort.by(Sort.Direction.DESC, "createdAt")),
                        ActivityTemplate.class
                )
                .stream()
                .map(this::toActivityResponse)
                .toList();

        return PaginatedResponse.of(content, safePage, safeSize, total);
    }

    public AdminActivityResponse disableActivity(
            String id,
            AdminActivityModerationRequest request,
            Authentication authentication
    ) {
        User admin = requireAdmin(authentication);
        ActivityTemplate template = activityTemplateRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Activity not found"));

        if (template.isArchived()) {
            return toActivityResponse(template);
        }

        String reason = normalizeGuideSuspensionReason(request == null ? null : request.reason());
        template.setArchived(true);
        template.setArchivedAt(java.time.Instant.now());
        ActivityTemplate saved = activityTemplateRepository.save(template);

        auditLogService.logAction(
                admin,
                AdminAuditAction.DISABLE_ACTIVITY,
                AdminAuditTargetType.ACTIVITY,
                saved.getId(),
                saved.getTitle(),
                reason,
                "Activity disabled by admin. Sessions/bookings/refunds unchanged."
        );

        return toActivityResponse(saved);
    }

    public AdminActivityResponse republishActivity(
            String id,
            AdminActivityModerationRequest request,
            Authentication authentication
    ) {
        User admin = requireAdmin(authentication);
        ActivityTemplate template = activityTemplateRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Activity not found"));

        if (!template.isArchived()) {
            return toActivityResponse(template);
        }

        User guide = userRepository.findById(template.getGuideId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.CONFLICT, "Guide not found"));
        if (guide.getRole() != Role.GUIDE || !guide.isVerified() || !guide.isEnabled() || guide.isSuspended()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Activity guide is not active or bookable");
        }

        String reason = normalizeReason(request == null ? null : request.reason());
        template.setArchived(false);
        template.setArchivedAt(null);
        ActivityTemplate saved = activityTemplateRepository.save(template);

        auditLogService.logAction(
                admin,
                AdminAuditAction.REPUBLISH_ACTIVITY,
                AdminAuditTargetType.ACTIVITY,
                saved.getId(),
                saved.getTitle(),
                reason,
                "Activity republished by admin. Cancelled sessions were not republished automatically."
        );

        return toActivityResponse(saved);
    }

    public AdminCancelSessionResponse cancelSession(
            String sessionId,
            AdminCancelSessionRequest request,
            Authentication authentication
    ) {
        User admin = requireAdmin(authentication);
        ActivitySession session = activitySessionRepository.findById(sessionId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Session not found"));

        List<com.untamed.untamedbackend.booking.Booking> bookings =
                bookingRepository.findBySessionIdOrderByCreatedAtAsc(sessionId);
        int affectedBookings = bookings.size();

        if (session.getStatus() == ActivityStatus.CANCELLED) {
            return new AdminCancelSessionResponse(
                    session.getId(),
                    session.getStatus().name(),
                    affectedBookings,
                    0,
                    countBookings(bookings, BookingStatus.PAYING),
                    countBookings(bookings, BookingStatus.COMPLETED),
                    0,
                    0,
                    "Session is already cancelled"
            );
        }

        String reason = normalizeReason(request == null ? null : request.reason());
        boolean notifyUsers = request == null || request.notifyUsers() == null || Boolean.TRUE.equals(request.notifyUsers());
        var now = java.time.Instant.now();
        ActivityTemplate template = activityTemplateRepository.findById(session.getTemplateId()).orElse(null);
        String activityTitle = template == null ? "this activity" : template.getTitle();

        session.setStatus(ActivityStatus.CANCELLED);
        session.setCancellationReason(reason);
        session.setCancelledAt(now);
        session.setCancelledBy("ADMIN");
        activitySessionRepository.save(session);

        int pendingCancelled = 0;
        int payingNeedsReview = 0;
        int paidNeedsRefund = 0;
        int usersNotified = 0;
        int notificationsFailed = 0;

        for (var booking : bookings) {
            if (booking.getStatus() == BookingStatus.PENDING) {
                if (booking.getNumberOfPeople() > 0) {
                    try {
                        sessionSeatOps.releaseSeats(sessionId, booking.getNumberOfPeople());
                    } catch (ResponseStatusException e) {
                        System.out.println(
                                "Could not release seats for pending booking "
                                        + booking.getId()
                                        + " during admin session cancellation: "
                                        + e.getReason()
                        );
                    }
                }
                booking.setStatus(BookingStatus.CANCELLED);
                booking.setExpiresAt(null);
                booking.setCancelledBy(CancelledBy.ADMIN);
                booking.setCancellationReason(reason);
                booking.setCancelledAt(now);
                booking.setUpdatedAt(now);
                bookingRepository.save(booking);
                pendingCancelled++;
                if (notifyUsers) {
                    if (notifySessionCancellationUser(
                            booking.getUserId(),
                            booking.getId(),
                            "Session cancelled",
                            "Your pending booking for " + activityTitle + " was cancelled because the session is no longer available.",
                            NotificationType.SESSION_CANCELLED,
                            NotificationSeverity.WARNING
                    )) {
                        usersNotified++;
                    } else {
                        notificationsFailed++;
                    }
                }
            } else if (booking.getStatus() == BookingStatus.PAYING) {
                booking.setCancelledBy(CancelledBy.ADMIN);
                booking.setCancellationReason(reason);
                booking.setUpdatedAt(now);
                bookingRepository.save(booking);
                payingNeedsReview++;
                if (notifyUsers) {
                    if (notifySessionCancellationUser(
                            booking.getUserId(),
                            booking.getId(),
                            "Session cancelled",
                            "Your payment is under review because the session for " + activityTitle + " was cancelled.",
                            NotificationType.SESSION_CANCELLED,
                            NotificationSeverity.WARNING
                    )) {
                        usersNotified++;
                    } else {
                        notificationsFailed++;
                    }
                }
            } else if (booking.getStatus() == BookingStatus.COMPLETED) {
                booking.setStatus(BookingStatus.CANCELLED);
                booking.setRefundStatus(RefundStatus.REFUND_PENDING);
                booking.setRefundPercent(100);
                booking.setCancelledBy(CancelledBy.ADMIN);
                booking.setCancellationReason(reason);
                booking.setCancelledAt(now);
                booking.setUpdatedAt(now);
                bookingRepository.save(booking);
                paidNeedsRefund++;
                if (notifyUsers) {
                    if (notifySessionCancellationUser(
                            booking.getUserId(),
                            booking.getId(),
                            "Session cancelled - refund pending",
                            "Your booking for " + activityTitle + " was cancelled by Untamed. A refund is pending and will be processed soon.",
                            NotificationType.SESSION_CANCELLED_REFUND_PENDING,
                            NotificationSeverity.WARNING
                    )) {
                        usersNotified++;
                    } else {
                        notificationsFailed++;
                    }
                }
            }
        }

        List<GuestPass> passes = guestPassRepository.findBySessionId(sessionId);
        passes.forEach(GuestPass::cancel);
        if (!passes.isEmpty()) {
            guestPassRepository.saveAll(passes);
        }

        try {
            chatService.refreshRoomParticipantsForSession(sessionId);
            chatService.createSystemMessageForSession(sessionId, "This session was cancelled by Untamed admin.");
        } catch (RuntimeException e) {
            System.out.println("Could not refresh chat after admin session cancellation: " + e.getMessage());
        }

        System.out.println(
                "Admin cancelled session " + sessionId
                        + ". paidNeedsRefund=" + paidNeedsRefund
                        + ", payingNeedsReview=" + payingNeedsReview
                        + ". TODO: Automatic Stripe refund will be implemented in Admin Refund Workflow later."
        );

        auditLogService.logAction(
                admin,
                AdminAuditAction.CANCEL_SESSION,
                AdminAuditTargetType.SESSION,
                session.getId(),
                buildSessionLabel(template, session),
                reason,
                "affectedBookings=" + affectedBookings
                        + ", pendingCancelled=" + pendingCancelled
                        + ", payingNeedsReview=" + payingNeedsReview
                        + ", paidNeedsRefund=" + paidNeedsRefund
                        + ", usersNotified=" + usersNotified
                        + ", notificationsFailed=" + notificationsFailed
        );

        return new AdminCancelSessionResponse(
                session.getId(),
                session.getStatus().name(),
                affectedBookings,
                pendingCancelled,
                payingNeedsReview,
                paidNeedsRefund,
                usersNotified,
                notificationsFailed,
                "Session cancelled successfully"
        );
    }

    public List<AdminRefundItemResponse> getPendingRefunds() {
        return bookingRepository.findByRefundStatusInOrderByCancelledAtDesc(
                        List.of(RefundStatus.REFUND_PENDING, RefundStatus.REFUND_FAILED)
                )
                .stream()
                .map(booking -> toRefundItemResponse(booking, null))
                .toList();
    }

    public List<AdminRefundItemResponse> getRefunds() {
        return bookingRepository.findByRefundStatusInOrderByCancelledAtDesc(
                        List.of(
                                RefundStatus.REFUND_PENDING,
                                RefundStatus.REFUND_FAILED,
                                RefundStatus.REFUNDED,
                                RefundStatus.PARTIALLY_REFUNDED,
                                RefundStatus.NOT_REFUNDABLE
                        )
                )
                .stream()
                .map(booking -> toRefundItemResponse(booking, null))
                .toList();
    }

    public AdminRefundItemResponse processRefund(
            String bookingId,
            AdminProcessRefundRequest request,
            Authentication authentication
    ) {
        User admin = requireAdmin(authentication);
        var booking = bookingRepository.findById(bookingId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Booking not found"));
        boolean notifyUser = request == null || request.notifyUser() == null || Boolean.TRUE.equals(request.notifyUser());

        if (booking.getRefundStatus() == RefundStatus.REFUNDED
                || booking.getRefundStatus() == RefundStatus.PARTIALLY_REFUNDED) {
            return toRefundItemResponse(booking, "Booking is already refunded");
        }

        if (booking.getStatus() != BookingStatus.CANCELLED) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Only cancelled bookings can be refunded");
        }

        if (booking.getRefundStatus() != RefundStatus.REFUND_PENDING
                && booking.getRefundStatus() != RefundStatus.REFUND_FAILED) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Booking is not pending refund");
        }

        PaymentAttempt attempt = paymentAttemptRepository
                .findFirstByBookingIdAndProviderAndStatusOrderByCreatedAtDesc(
                        booking.getId(),
                        PaymentProvider.STRIPE,
                        PaymentAttemptStatus.SUCCEEDED
                )
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.CONFLICT,
                        "Paid Stripe payment attempt not found"
                ));

        int refundAmount = calculateRefundAmount(booking, attempt);

        try {
            String stripeRefundId = stripeRefundService.refundPaymentAttempt(
                    attempt,
                    refundAmount,
                    "ADMIN_SESSION_CANCELLED"
            );

            booking.setRefundStatus(booking.getRefundPercent() >= 100
                    ? RefundStatus.REFUNDED
                    : RefundStatus.PARTIALLY_REFUNDED);
            booking.setRefundAmount(refundAmount);
            booking.setRefundCurrency(attempt.getCurrency());
            booking.setStripeRefundId(stripeRefundId);
            booking.setUpdatedAt(java.time.Instant.now());

            var saved = bookingRepository.save(booking);
            boolean userNotified = false;
            if (notifyUser) {
                userNotified = notifyRefundUser(
                        saved,
                        NotificationType.REFUND_PROCESSED,
                        NotificationSeverity.SUCCESS,
                        "Refund processed",
                        "Your refund for " + refundActivityTitle(saved) + " has been processed. It may take a few business days to appear on your bank statement."
                );
            }
            auditLogService.logAction(
                    admin,
                    AdminAuditAction.PROCESS_REFUND,
                    AdminAuditTargetType.REFUND,
                    saved.getId(),
                    refundTargetLabel(saved),
                    saved.getCancellationReason(),
                    "refundAmount=" + refundAmount
                            + ", refundPercent=" + saved.getRefundPercent()
                            + ", stripeRefundId=" + stripeRefundId
                            + ", userNotified=" + userNotified
            );
            return toRefundItemResponse(
                    saved,
                    userNotified ? "Refund processed successfully. User notified." : "Refund processed successfully.",
                    userNotified
            );
        } catch (RuntimeException e) {
            booking.setRefundStatus(RefundStatus.REFUND_FAILED);
            booking.setUpdatedAt(java.time.Instant.now());
            var saved = bookingRepository.save(booking);
            boolean userNotified = false;
            if (notifyUser) {
                userNotified = notifyRefundUser(
                        saved,
                        NotificationType.REFUND_FAILED_REVIEW,
                        NotificationSeverity.WARNING,
                        "Refund requires review",
                        "We could not automatically process your refund. Our team will review it manually."
                );
            }
            auditLogService.logAction(
                    admin,
                    AdminAuditAction.REFUND_FAILED,
                    AdminAuditTargetType.REFUND,
                    saved.getId(),
                    refundTargetLabel(saved),
                    saved.getCancellationReason(),
                    "error=" + e.getMessage() + ", userNotified=" + userNotified
            );
            System.out.println("Admin refund failed for booking " + bookingId + ": " + e.getMessage());
            throw e;
        }
    }

    public AdminGuideResponse verifyGuide(
            String id,
            AdminGuideVerifyRequest request,
            Authentication authentication
    ) {
        User admin = requireAdmin(authentication);
        User guide = requireGuide(id);
        User.GuideProfile guideProfile = guide.getGuideProfile();
        if (guideProfile == null) {
            guideProfile = User.GuideProfile.builder().build();
            guide.setGuideProfile(guideProfile);
        }
        String reason = normalizeGuideVerificationReason(request == null ? null : request.reason());
        guideProfile.setVerifiedBadge(true);
        User saved = userRepository.save(guide);
        auditLogService.logAction(
                admin,
                AdminAuditAction.VERIFY_GUIDE,
                AdminAuditTargetType.GUIDE,
                saved.getId(),
                saved.getUsername(),
                reason,
                "email=" + saved.getEmail() + ", verifiedBadge=" + hasVerifiedGuideBadge(saved)
        );
        return toGuideResponse(saved);
    }

    public AdminGuideResponse suspendGuide(
            String id,
            AdminGuideSuspendRequest request,
            Authentication authentication
    ) {
        User admin = requireAdmin(authentication);
        User guide = requireGuide(id);
        String reason = normalizeReason(request == null ? null : request.reason());
        guide.setSuspended(true);
        guide.setEnabled(false);
        User saved = userRepository.save(guide);

        if (request != null && Boolean.TRUE.equals(request.notifyGuide())) {
            notificationService.createAndSend(
                    saved.getId(),
                    NotificationType.GUIDE_SUSPENDED,
                    "Your guide account has been suspended",
                    buildGuideSuspendedMessage(reason),
                    NotificationSeverity.WARNING,
                    "/guide/activities",
                    "GUIDE",
                    saved.getId()
            );
        }

        auditLogService.logAction(
                admin,
                AdminAuditAction.SUSPEND_GUIDE,
                AdminAuditTargetType.GUIDE,
                saved.getId(),
                saved.getUsername(),
                reason,
                "email=" + saved.getEmail()
        );
        return toGuideResponse(saved);
    }

    public AdminGuideResponse reactivateGuide(
            String id,
            AdminGuideReactivateRequest request,
            Authentication authentication
    ) {
        User admin = requireAdmin(authentication);
        User guide = requireGuide(id);
        guide.setSuspended(false);
        guide.setEnabled(true);
        User saved = userRepository.save(guide);

        if (request != null && Boolean.TRUE.equals(request.notifyGuide())) {
            notificationService.createAndSend(
                    saved.getId(),
                    NotificationType.GUIDE_REACTIVATED,
                    "Your guide account has been reactivated",
                    "Your guide account has been reactivated. You can access guide tools again. Previously cancelled sessions remain unchanged.",
                    NotificationSeverity.SUCCESS,
                    "/guide/activities",
                    "GUIDE",
                    saved.getId()
            );
        }

        auditLogService.logAction(
                admin,
                AdminAuditAction.REACTIVATE_GUIDE,
                AdminAuditTargetType.GUIDE,
                saved.getId(),
                saved.getUsername(),
                "Admin reactivated guide",
                "email=" + saved.getEmail() + ", verifiedBadge=" + hasVerifiedGuideBadge(saved)
        );
        return toGuideResponse(saved);
    }

    private AdminUserResponse toUserResponse(User user) {
        return new AdminUserResponse(
                user.getId(),
                user.getUsername(),
                user.getEmail(),
                user.getRole() == null ? null : user.getRole().name(),
                user.isVerified(),
                user.isEnabled(),
                user.isSuspended(),
                user.getProfileImageUrl(),
                user.getCreatedAt(),
                deriveUserStatus(user)
        );
    }

    private AdminGuideResponse toGuideResponse(User user) {
        User.GuideProfile guideProfile = user.getGuideProfile();
        User.RatingSummary ratingSummary = guideProfile == null
                ? null
                : guideProfile.getRatingSummary();

        double rating = ratingSummary == null || ratingSummary.getAverage() == null
                ? 0.0
                : ratingSummary.getAverage();
        int ratingCount = ratingSummary == null || ratingSummary.getCount() == null
                ? 0
                : ratingSummary.getCount();

        return new AdminGuideResponse(
                user.getId(),
                user.getUsername(),
                user.getEmail(),
                user.getRole() == null ? Role.GUIDE.name() : user.getRole().name(),
                hasVerifiedGuideBadge(user),
                user.isEnabled(),
                user.isSuspended(),
                user.getCreatedAt(),
                activityTemplateRepository.countByGuideIdAndArchivedFalse(user.getId()),
                rating,
                deriveGuideStatus(user),
                user.getBio(),
                user.getProfileImageUrl(),
                guideProfile == null ? null : guideProfile.getExperienceYears(),
                ratingCount,
                guideProfile == null || guideProfile.getCertificates() == null
                        ? List.of()
                        : guideProfile.getCertificates()
                                .stream()
                                .map(this::toGuideCertificateResponse)
                                .toList()
        );
    }

    private AdminGuideResponse.Certificate toGuideCertificateResponse(User.Certificate certificate) {
        return new AdminGuideResponse.Certificate(
                certificate.getId(),
                certificate.getTitle(),
                certificate.getIssuer(),
                certificate.getCredentialId(),
                certificate.getIssuedAt(),
                certificate.getExpiresAt(),
                certificate.getVerificationUrl(),
                certificate.getFileUrl(),
                certificate.getFileType(),
                certificate.getFileSizeBytes()
        );
    }

    private AdminSessionResponse toSessionResponse(ActivitySession session) {
        ActivityTemplate template = activityTemplateRepository.findById(session.getTemplateId()).orElse(null);
        User guide = userRepository.findById(session.getGuideId()).orElse(null);

        return new AdminSessionResponse(
                session.getId(),
                template == null ? "Unknown activity" : template.getTitle(),
                guide == null ? "Unknown guide" : guide.getUsername(),
                session.getStartAt(),
                session.getCapacity(),
                session.getBookedCount(),
                session.getStatus() == null ? null : session.getStatus().name()
        );
    }

    private List<AdminSessionResponse> toSessionResponses(List<ActivitySession> sessions) {
        Set<String> templateIds = sessions.stream()
                .map(ActivitySession::getTemplateId)
                .filter(id -> id != null && !id.isBlank())
                .collect(Collectors.toSet());
        Set<String> guideIds = sessions.stream()
                .map(ActivitySession::getGuideId)
                .filter(id -> id != null && !id.isBlank())
                .collect(Collectors.toSet());
        Map<String, ActivityTemplate> templatesById = activityTemplateRepository.findAllById(templateIds)
                .stream()
                .collect(Collectors.toMap(ActivityTemplate::getId, Function.identity()));
        Map<String, User> guidesById = userRepository.findAllById(guideIds)
                .stream()
                .collect(Collectors.toMap(User::getId, Function.identity()));

        return sessions.stream()
                .map(session -> {
                    ActivityTemplate template = templatesById.get(session.getTemplateId());
                    User guide = guidesById.get(session.getGuideId());
                    return new AdminSessionResponse(
                            session.getId(),
                            template == null ? "Unknown activity" : template.getTitle(),
                            guide == null ? "Unknown guide" : guide.getUsername(),
                            session.getStartAt(),
                            session.getCapacity(),
                            session.getBookedCount(),
                            session.getStatus() == null ? null : session.getStatus().name()
                    );
                })
                .toList();
    }

    private AdminGuideSuspensionImpactResponse.SessionImpact toSuspensionImpactSession(ActivitySession session) {
        ActivityTemplate template = activityTemplateRepository.findById(session.getTemplateId()).orElse(null);
        var bookings = bookingRepository.findBySessionIdOrderByCreatedAtAsc(session.getId());
        int confirmed = countBookings(bookings, BookingStatus.COMPLETED);
        int pending = countBookings(bookings, BookingStatus.PENDING);
        int paying = countBookings(bookings, BookingStatus.PAYING);
        double paidAmount = bookings.stream()
                .filter(booking -> booking.getStatus() == BookingStatus.COMPLETED)
                .mapToInt(booking -> paymentAttemptRepository
                        .findFirstByBookingIdAndProviderAndStatusOrderByCreatedAtDesc(
                                booking.getId(),
                                PaymentProvider.STRIPE,
                                PaymentAttemptStatus.SUCCEEDED
                        )
                        .map(PaymentAttempt::getAmount)
                        .orElse(0))
                .mapToDouble(this::toMajorAmount)
                .sum();

        return new AdminGuideSuspensionImpactResponse.SessionImpact(
                session.getId(),
                template == null ? "Unknown activity" : template.getTitle(),
                session.getStartAt(),
                session.getStatus() == null ? null : session.getStatus().name(),
                confirmed,
                pending,
                paying,
                paidAmount
        );
    }

    private AdminActivityResponse toActivityResponse(ActivityTemplate template) {
        User guide = userRepository.findById(template.getGuideId()).orElse(null);

        return new AdminActivityResponse(
                template.getId(),
                template.getTitle(),
                categoryLabel(template),
                locationLabel(template),
                template.getGuideId(),
                guide == null ? "Unknown guide" : guide.getUsername(),
                guide == null ? "" : guide.getEmail(),
                coverImageUrl(template),
                template.isArchived() ? "DISABLED" : "PUBLISHED",
                activitySessionRepository.countByTemplateId(template.getId()),
                activitySessionRepository.countByTemplateIdAndStatus(template.getId(), ActivityStatus.PUBLISHED),
                template.getCreatedAt()
        );
    }

    private AdminRefundItemResponse toRefundItemResponse(
            com.untamed.untamedbackend.booking.Booking booking,
            String message
    ) {
        return toRefundItemResponse(booking, message, false);
    }

    private AdminRefundItemResponse toRefundItemResponse(
            com.untamed.untamedbackend.booking.Booking booking,
            String message,
            boolean userNotified
    ) {
        ActivitySession session = activitySessionRepository.findById(booking.getSessionId()).orElse(null);
        ActivityTemplate template = session == null
                ? null
                : activityTemplateRepository.findById(session.getTemplateId()).orElse(null);
        User user = userRepository.findById(booking.getUserId()).orElse(null);
        PaymentAttempt attempt = paymentAttemptRepository
                .findFirstByBookingIdAndProviderAndStatusOrderByCreatedAtDesc(
                        booking.getId(),
                        PaymentProvider.STRIPE,
                        PaymentAttemptStatus.SUCCEEDED
                )
                .orElse(null);

        int paidAmount = attempt == null ? 0 : Math.max(0, attempt.getAmount());
        int refundAmount = booking.getRefundAmount() > 0
                ? booking.getRefundAmount()
                : calculateRefundAmountOrZero(booking, paidAmount);

        return new AdminRefundItemResponse(
                booking.getId(),
                user == null ? "Unknown user" : user.getUsername(),
                user == null ? "" : user.getEmail(),
                template == null ? "Unknown activity" : template.getTitle(),
                session == null ? null : session.getStartAt(),
                toMajorAmount(paidAmount),
                booking.getRefundPercent(),
                toMajorAmount(refundAmount),
                booking.getRefundStatus() == null ? null : booking.getRefundStatus().name(),
                attempt == null ? null : attempt.getProviderRef(),
                booking.getCancellationReason(),
                booking.getCancelledAt(),
                userNotified,
                message
        );
    }

    private String deriveGuideStatus(User user) {
        if (user.isSuspended()) return "SUSPENDED";
        if (!hasVerifiedGuideBadge(user)) return "PENDING_VERIFICATION";
        if (!user.isEnabled()) return "DISABLED";
        return "VERIFIED";
    }

    private String categoryLabel(ActivityTemplate template) {
        if (template.getCategoryIds() == null || template.getCategoryIds().isEmpty()) {
            return "Uncategorized";
        }

        return template.getCategoryIds()
                .stream()
                .map(id -> categoryRepository.findById(id).map(com.untamed.untamedbackend.model.Category::getName).orElse(id))
                .reduce((left, right) -> left + ", " + right)
                .orElse("Uncategorized");
    }

    private String locationLabel(ActivityTemplate template) {
        if (template.getAddressId() == null || template.getAddressId().isBlank()) {
            return "Unknown location";
        }

        return addressRepository.findById(template.getAddressId())
                .map(address -> {
                    if (address.getGovernorate() == null || address.getGovernorate().isBlank()) {
                        return address.getDisplayName();
                    }
                    return address.getDisplayName() + " · " + address.getGovernorate();
                })
                .orElse("Unknown location");
    }

    private String deriveUserStatus(User user) {
        if (user.isSuspended()) return "SUSPENDED";
        if (!user.isEnabled()) return "DISABLED";
        if (!user.isVerified()) return "PENDING_VERIFICATION";
        return "ACTIVE";
    }

    private Query queryFrom(List<Criteria> criteria) {
        Query query = new Query();
        if (!criteria.isEmpty()) {
            query.addCriteria(new Criteria().andOperator(criteria.toArray(Criteria[]::new)));
        }
        return query;
    }

    private Pattern containsPattern(String value) {
        return Pattern.compile(Pattern.quote(value.trim()), Pattern.CASE_INSENSITIVE);
    }

    private int safePage(int page) {
        return Math.max(0, page);
    }

    private int safeSize(int size) {
        return Math.max(1, Math.min(100, size));
    }

    private String trimToNull(String value) {
        if (value == null || value.isBlank()) return null;
        return value.trim();
    }

    private Role parseRole(String role) {
        String value = trimToNull(role);
        if (value == null || "ALL".equalsIgnoreCase(value)) return null;
        try {
            return Role.valueOf(value.toUpperCase());
        } catch (IllegalArgumentException e) {
            return null;
        }
    }

    private ActivityStatus parseActivityStatus(String status) {
        String value = trimToNull(status);
        if (value == null || "ALL".equalsIgnoreCase(value)) return null;
        try {
            return ActivityStatus.valueOf(value.toUpperCase());
        } catch (IllegalArgumentException e) {
            return null;
        }
    }

    private Criteria userStatusCriteria(String status) {
        String value = trimToNull(status);
        if (value == null || "ALL".equalsIgnoreCase(value)) return null;

        return switch (value.toUpperCase()) {
            case "ACTIVE" -> new Criteria().andOperator(
                    Criteria.where("suspended").is(false),
                    Criteria.where("enabled").is(true),
                    Criteria.where("verified").is(true)
            );
            case "SUSPENDED" -> Criteria.where("suspended").is(true);
            case "DISABLED" -> new Criteria().andOperator(
                    Criteria.where("suspended").is(false),
                    Criteria.where("enabled").is(false)
            );
            case "PENDING_VERIFICATION" -> Criteria.where("verified").is(false);
            default -> null;
        };
    }

    private Criteria guideStatusCriteria(String status) {
        String value = trimToNull(status);
        if (value == null || "ALL".equalsIgnoreCase(value)) return null;

        return switch (value.toUpperCase()) {
            case "VERIFIED" -> new Criteria().andOperator(
                    Criteria.where("suspended").is(false),
                    Criteria.where("enabled").is(true),
                    Criteria.where(GUIDE_VERIFIED_BADGE_FIELD).is(true)
            );
            case "SUSPENDED" -> Criteria.where("suspended").is(true);
            case "DISABLED" -> new Criteria().andOperator(
                    Criteria.where("suspended").is(false),
                    Criteria.where("enabled").is(false),
                    Criteria.where(GUIDE_VERIFIED_BADGE_FIELD).is(true)
            );
            case "PENDING_VERIFICATION" -> new Criteria().andOperator(
                    Criteria.where("suspended").is(false),
                    Criteria.where(GUIDE_VERIFIED_BADGE_FIELD).is(false)
            );
            default -> null;
        };
    }

    private Criteria activityTemplateStatusCriteria(String status) {
        String value = trimToNull(status);
        if (value == null || "ALL".equalsIgnoreCase(value)) return null;

        return switch (value.toUpperCase()) {
            case "PUBLISHED" -> Criteria.where("archived").is(false);
            case "DISABLED" -> Criteria.where("archived").is(true);
            default -> null;
        };
    }

    private double calculateTotalRevenue() {
        int totalMinorUnits = paymentAttemptRepository.findByStatus(PaymentAttemptStatus.SUCCEEDED)
                .stream()
                .mapToInt(payment -> Math.max(0, payment.getAmount()))
                .sum();

        return totalMinorUnits / 100.0;
    }

    private int calculateRefundAmount(com.untamed.untamedbackend.booking.Booking booking, PaymentAttempt attempt) {
        int amount = calculateRefundAmountOrZero(booking, Math.max(0, attempt.getAmount()));
        if (amount <= 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Refund amount must be greater than 0");
        }
        return amount;
    }

    private int calculateRefundAmountOrZero(com.untamed.untamedbackend.booking.Booking booking, int paidAmount) {
        int percent = Math.max(0, Math.min(100, booking.getRefundPercent()));
        if (paidAmount <= 0 || percent <= 0) return 0;
        return Math.round((paidAmount * percent) / 100.0f);
    }

    private double toMajorAmount(int minorAmount) {
        return Math.max(0, minorAmount) / 100.0;
    }

    private int countBookings(List<com.untamed.untamedbackend.booking.Booking> bookings, BookingStatus status) {
        return (int) bookings.stream().filter(booking -> booking.getStatus() == status).count();
    }

    private String normalizeReason(String reason) {
        if (reason == null || reason.isBlank()) {
            return "ADMIN_SESSION_CANCELLED";
        }
        return reason.trim();
    }

    private List<AdminOverviewResponse.AlertStatusBucket> buildAlertStatusBuckets() {
        return List.of(AdminAlertStatus.OPEN, AdminAlertStatus.ACKNOWLEDGED, AdminAlertStatus.RESOLVED)
                .stream()
                .map(status -> new AdminOverviewResponse.AlertStatusBucket(status.name(), countAlertsByStatus(status)))
                .toList();
    }

    private long countAlertsByStatus(AdminAlertStatus status) {
        Query query = new Query(Criteria.where("status").is(status));
        return mongoTemplate.count(query, AdminAlert.class);
    }

    private String coverImageUrl(ActivityTemplate template) {
        if (template.getImages() == null || template.getImages().isEmpty()) {
            return null;
        }
        return template.getImages()
                .stream()
                .filter(image -> image != null && image.isCover() && image.getUrl() != null && !image.getUrl().isBlank())
                .findFirst()
                .or(() -> template.getImages()
                        .stream()
                        .filter(image -> image != null && image.getUrl() != null && !image.getUrl().isBlank())
                        .findFirst())
                .map(com.untamed.untamedbackend.model.ActivityImage::getUrl)
                .orElse(null);
    }

    private String normalizeGuideVerificationReason(String reason) {
        if (reason == null || reason.isBlank()) {
            return "Admin verified guide";
        }
        return reason.trim();
    }

    private String buildGuideSuspendedMessage(String reason) {
        String base = "Your guide account has been suspended by Untamed admin. You cannot create or manage activities while suspended. Existing bookings are not automatically cancelled or refunded.";
        if (reason == null || reason.isBlank() || "ADMIN_GUIDE_SUSPENDED".equals(reason)) {
            return base;
        }
        return base + " Reason: " + reason;
    }

    private boolean notifySessionCancellationUser(
            String userId,
            String bookingId,
            String title,
            String message,
            NotificationType type,
            NotificationSeverity severity
    ) {
        try {
            notificationService.createAndSend(
                    userId,
                    type,
                    title,
                    message,
                    severity,
                    "/my-bookings",
                    "BOOKING",
                    bookingId
            );
            return true;
        } catch (RuntimeException e) {
            System.out.println("Could not notify user " + userId + " for booking " + bookingId + ": " + e.getMessage());
            return false;
        }
    }

    private boolean notifyRefundUser(
            com.untamed.untamedbackend.booking.Booking booking,
            NotificationType type,
            NotificationSeverity severity,
            String title,
            String message
    ) {
        try {
            notificationService.createAndSend(
                    booking.getUserId(),
                    type,
                    title,
                    message,
                    severity,
                    "/my-bookings",
                    "BOOKING",
                    booking.getId()
            );
            return true;
        } catch (RuntimeException e) {
            System.out.println("Could not notify refund user for booking " + booking.getId() + ": " + e.getMessage());
            return false;
        }
    }

    private String refundActivityTitle(com.untamed.untamedbackend.booking.Booking booking) {
        ActivitySession session = activitySessionRepository.findById(booking.getSessionId()).orElse(null);
        ActivityTemplate template = session == null
                ? null
                : activityTemplateRepository.findById(session.getTemplateId()).orElse(null);
        return template == null ? "your cancelled session" : template.getTitle();
    }

    private String normalizeGuideSuspensionReason(String reason) {
        if (reason == null || reason.isBlank()) {
            return "ADMIN_GUIDE_SUSPENDED";
        }
        return reason.trim();
    }

    private User requireAdmin(Authentication authentication) {
        if (authentication == null || !authentication.isAuthenticated()) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Authentication required");
        }

        Object principal = authentication.getPrincipal();
        if (principal instanceof AuthenticatedUser authenticatedUser) {
            User admin = userRepository.findById(authenticatedUser.getId())
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Admin user not found"));
            if (admin.getRole() != Role.ADMIN) {
                throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Admin role required");
            }
            return admin;
        }

        throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Authentication required");
    }

    private User requireUserForAccountAction(String id) {
        return userRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));
    }

    private void assertCanManageUser(User admin, User target) {
        if (admin.getId() != null && admin.getId().equals(target.getId())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Admin cannot suspend or reactivate himself");
        }

        if (target.getRole() == Role.ADMIN) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Admin users cannot be suspended in V1");
        }
    }

    private String buildSessionLabel(ActivityTemplate template, ActivitySession session) {
        String title = template == null ? "Unknown activity" : template.getTitle();
        String date = session.getStartAt() == null ? "unscheduled" : session.getStartAt().toString();
        return title + " - " + date;
    }

    private String refundTargetLabel(com.untamed.untamedbackend.booking.Booking booking) {
        ActivitySession session = activitySessionRepository.findById(booking.getSessionId()).orElse(null);
        ActivityTemplate template = session == null
                ? null
                : activityTemplateRepository.findById(session.getTemplateId()).orElse(null);
        return (template == null ? "Unknown activity" : template.getTitle()) + " - booking " + booking.getId();
    }

    private User requireGuide(String id) {
        User user = userRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Guide not found"));

        if (user.getRole() != Role.GUIDE) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Target user is not a guide");
        }

        return user;
    }
}

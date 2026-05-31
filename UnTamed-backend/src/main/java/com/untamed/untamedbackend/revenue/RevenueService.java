package com.untamed.untamedbackend.revenue;

import com.untamed.untamedbackend.booking.Booking;
import com.untamed.untamedbackend.booking.BookingRepository;
import com.untamed.untamedbackend.booking.BookingStatus;
import com.untamed.untamedbackend.model.ActivitySession;
import com.untamed.untamedbackend.model.ActivityStatus;
import com.untamed.untamedbackend.model.ActivityTemplate;
import com.untamed.untamedbackend.model.Role;
import com.untamed.untamedbackend.model.User;
import com.untamed.untamedbackend.payment.PaymentAttempt;
import com.untamed.untamedbackend.payment.PaymentAttemptRepository;
import com.untamed.untamedbackend.payment.PaymentAttemptStatus;
import com.untamed.untamedbackend.repository.ActivitySessionRepository;
import com.untamed.untamedbackend.repository.ActivityTemplateRepository;
import com.untamed.untamedbackend.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.DayOfWeek;
import java.time.Instant;
import java.time.ZoneOffset;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class RevenueService {

    private static final BigDecimal COMMISSION_RATE = new BigDecimal("0.10");

    private final RevenueRecordRepository revenueRecordRepository;
    private final PayoutBatchRepository payoutBatchRepository;
    private final BookingRepository bookingRepository;
    private final PaymentAttemptRepository paymentAttemptRepository;
    private final ActivitySessionRepository activitySessionRepository;
    private final ActivityTemplateRepository activityTemplateRepository;
    private final UserRepository userRepository;

    public RevenueRecord recordPaidBookingIfAbsent(String bookingId) {
        if (bookingId == null || bookingId.isBlank()) {
            return null;
        }

        RevenueRecord existing = revenueRecordRepository.findByBookingId(bookingId).orElse(null);
        if (existing != null) {
            return existing;
        }

        Booking booking = bookingRepository.findById(bookingId).orElse(null);
        if (booking == null || booking.getStatus() != BookingStatus.COMPLETED) {
            return null;
        }

        PaymentAttempt attempt = findSucceededPaymentAttempt(bookingId);
        if (attempt == null || attempt.getAmount() <= 0) {
            return null;
        }

        ActivitySession session = activitySessionRepository.findById(booking.getSessionId()).orElse(null);
        if (session == null || session.getGuideId() == null || session.getGuideId().isBlank()) {
            return null;
        }

        int gross = Math.max(0, attempt.getAmount());
        int commission = calculateCommission(gross);
        int guidePayout = Math.max(0, gross - commission);
        Instant now = Instant.now();
        boolean sessionCompleted = session.getStatus() == ActivityStatus.COMPLETED;

        RevenueRecord record = RevenueRecord.builder()
                .bookingId(booking.getId())
                .paymentAttemptId(attempt.getId())
                .sessionId(booking.getSessionId())
                .templateId(session.getTemplateId())
                .guideId(session.getGuideId())
                .userId(booking.getUserId())
                .grossAmountMinor(gross)
                .platformCommissionMinor(commission)
                .guidePayoutMinor(guidePayout)
                .currency(normalizeCurrency(attempt.getCurrency()))
                .commissionRate(COMMISSION_RATE)
                .status(sessionCompleted
                        ? RevenueRecordStatus.READY_FOR_PAYOUT
                        : RevenueRecordStatus.PENDING_SESSION_COMPLETION)
                .createdAt(now)
                .updatedAt(now)
                .sessionCompletedAt(sessionCompleted ? now : null)
                .build();

        try {
            return revenueRecordRepository.save(record);
        } catch (DuplicateKeyException ignored) {
            return revenueRecordRepository.findByBookingId(bookingId).orElse(null);
        }
    }

    public void markSessionRevenueReady(String sessionId) {
        if (sessionId == null || sessionId.isBlank()) {
            return;
        }

        ActivitySession session = activitySessionRepository.findById(sessionId).orElse(null);
        if (session == null || session.getStatus() != ActivityStatus.COMPLETED) {
            return;
        }

        List<Booking> completedBookings =
                bookingRepository.findBySessionIdAndStatus(sessionId, BookingStatus.COMPLETED);

        for (Booking booking : completedBookings) {
            recordPaidBookingIfAbsent(booking.getId());
        }

        List<RevenueRecord> pending =
                revenueRecordRepository.findBySessionIdAndStatus(sessionId, RevenueRecordStatus.PENDING_SESSION_COMPLETION);
        if (pending.isEmpty()) {
            return;
        }

        Instant now = Instant.now();
        for (RevenueRecord record : pending) {
            record.setStatus(RevenueRecordStatus.READY_FOR_PAYOUT);
            record.setSessionCompletedAt(now);
            record.setUpdatedAt(now);
        }

        revenueRecordRepository.saveAll(pending);
    }

    public void assertBookingRevenueRefundAdjustable(String bookingId) {
        RevenueRecord record = revenueRecordRepository.findByBookingId(bookingId).orElse(null);
        if (record == null || record.getStatus() == RevenueRecordStatus.VOIDED) {
            return;
        }

        if (record.getStatus() == RevenueRecordStatus.PAYOUT_SCHEDULED
                || record.getStatus() == RevenueRecordStatus.PAID) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "Revenue for this booking is already scheduled or paid. Resolve the payout before refunding."
            );
        }
    }

    public RevenueRecord applyRefundAdjustment(String bookingId, int refundAmountMinor) {
        if (bookingId == null || bookingId.isBlank()) {
            return null;
        }

        RevenueRecord record = revenueRecordRepository.findByBookingId(bookingId).orElse(null);
        if (record == null) {
            return null;
        }

        assertBookingRevenueRefundAdjustable(bookingId);

        PaymentAttempt attempt = findSucceededPaymentAttempt(bookingId);
        if (attempt == null || attempt.getAmount() <= 0) {
            return record;
        }

        int originalGross = Math.max(0, attempt.getAmount());
        int safeRefund = Math.max(0, Math.min(refundAmountMinor, originalGross));
        int retainedGross = Math.max(0, originalGross - safeRefund);
        Instant now = Instant.now();

        if (retainedGross <= 0) {
            record.setGrossAmountMinor(0);
            record.setPlatformCommissionMinor(0);
            record.setGuidePayoutMinor(0);
            record.setStatus(RevenueRecordStatus.VOIDED);
            record.setPayoutBatchId(null);
            record.setUpdatedAt(now);
            return revenueRecordRepository.save(record);
        }

        int commission = calculateCommission(retainedGross);
        record.setGrossAmountMinor(retainedGross);
        record.setPlatformCommissionMinor(commission);
        record.setGuidePayoutMinor(Math.max(0, retainedGross - commission));
        record.setUpdatedAt(now);

        if (record.getStatus() == RevenueRecordStatus.VOIDED) {
            record.setStatus(statusForBookingSession(record));
        }

        return revenueRecordRepository.save(record);
    }

    public List<PayoutBatchResponse> createWeeklyPayoutBatches() {
        List<RevenueRecord> ready = revenueRecordRepository.findByStatus(RevenueRecordStatus.READY_FOR_PAYOUT)
                .stream()
                .filter(record -> record.getPayoutBatchId() == null || record.getPayoutBatchId().isBlank())
                .toList();

        if (ready.isEmpty()) {
            return List.of();
        }

        Instant now = Instant.now();
        Instant periodStart = weekStart(now);
        Instant periodEnd = periodStart.plus(7, ChronoUnit.DAYS);
        Map<String, List<RevenueRecord>> grouped = ready.stream()
                .collect(Collectors.groupingBy(
                        record -> record.getGuideId() + "|" + normalizeCurrency(record.getCurrency()),
                        LinkedHashMap::new,
                        Collectors.toList()
                ));

        List<PayoutBatch> created = new ArrayList<>();

        for (List<RevenueRecord> records : grouped.values()) {
            if (records.isEmpty()) {
                continue;
            }

            RevenueRecord first = records.getFirst();
            PayoutBatch batch = PayoutBatch.builder()
                    .guideId(first.getGuideId())
                    .periodStart(periodStart)
                    .periodEnd(periodEnd)
                    .totalGrossMinor(sumGross(records))
                    .totalCommissionMinor(sumCommission(records))
                    .totalPayoutMinor(sumPayout(records))
                    .currency(normalizeCurrency(first.getCurrency()))
                    .revenueRecordIds(records.stream().map(RevenueRecord::getId).filter(Objects::nonNull).toList())
                    .status(PayoutBatchStatus.CREATED)
                    .createdAt(now)
                    .updatedAt(now)
                    .build();

            PayoutBatch savedBatch = payoutBatchRepository.save(batch);

            for (RevenueRecord record : records) {
                record.setStatus(RevenueRecordStatus.PAYOUT_SCHEDULED);
                record.setPayoutBatchId(savedBatch.getId());
                record.setUpdatedAt(now);
            }
            revenueRecordRepository.saveAll(records);
            created.add(savedBatch);
        }

        return toPayoutResponses(created);
    }

    public GuideEarningsSummaryResponse getGuideEarningsSummary(String guideId) {
        List<RevenueRecord> records = revenueRecordRepository.findByGuideIdOrderByCreatedAtDesc(guideId);
        List<PayoutBatch> batches = payoutBatchRepository.findByGuideIdOrderByCreatedAtDesc(guideId);

        return new GuideEarningsSummaryResponse(
                sumGross(records),
                sumCommission(records),
                sumPayout(records),
                sumPayoutByStatus(records, RevenueRecordStatus.READY_FOR_PAYOUT),
                sumPayoutByStatus(records, RevenueRecordStatus.PAYOUT_SCHEDULED),
                sumPayoutByStatus(records, RevenueRecordStatus.PAID),
                records.size(),
                batches.size()
        );
    }

    public List<RevenueRecordResponse> getGuideRevenueRecords(String guideId) {
        return toRevenueResponses(revenueRecordRepository.findByGuideIdOrderByCreatedAtDesc(guideId));
    }

    public List<PayoutBatchResponse> getGuidePayouts(String guideId) {
        return toPayoutResponses(payoutBatchRepository.findByGuideIdOrderByCreatedAtDesc(guideId));
    }

    public AdminRevenueSummaryResponse getAdminRevenueSummary() {
        List<RevenueRecord> records = revenueRecordRepository.findAll();
        List<PayoutBatch> batches = payoutBatchRepository.findAll();

        return new AdminRevenueSummaryResponse(
                sumGross(records),
                sumCommission(records),
                sumPayout(records),
                sumPayoutByStatus(records, RevenueRecordStatus.READY_FOR_PAYOUT),
                sumPayoutByStatus(records, RevenueRecordStatus.PAYOUT_SCHEDULED),
                sumPayoutByStatus(records, RevenueRecordStatus.PAID),
                records.size(),
                countByStatus(records, RevenueRecordStatus.READY_FOR_PAYOUT),
                countByStatus(records, RevenueRecordStatus.PAYOUT_SCHEDULED),
                countByStatus(records, RevenueRecordStatus.PAID),
                batches.size()
        );
    }

    public List<RevenueRecordResponse> getAdminRevenueRecords() {
        return toRevenueResponses(revenueRecordRepository.findAll()
                .stream()
                .sorted(Comparator.comparing(
                        RevenueRecord::getCreatedAt,
                        Comparator.nullsLast(Comparator.reverseOrder())
                ))
                .toList());
    }

    public List<PayoutBatchResponse> getAdminPayoutBatches() {
        return toPayoutResponses(payoutBatchRepository.findAllByOrderByCreatedAtDesc());
    }

    public PayoutBatchResponse markPayoutBatchPaid(String batchId) {
        PayoutBatch batch = payoutBatchRepository.findById(batchId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Payout batch not found"));

        if (batch.getStatus() == PayoutBatchStatus.PAID) {
            return toPayoutResponses(List.of(batch)).getFirst();
        }

        Instant now = Instant.now();
        batch.setStatus(PayoutBatchStatus.PAID);
        batch.setPaidAt(now);
        batch.setUpdatedAt(now);
        PayoutBatch savedBatch = payoutBatchRepository.save(batch);

        List<RevenueRecord> records = safeList(batch.getRevenueRecordIds()).isEmpty()
                ? List.of()
                : revenueRecordRepository.findByIdIn(batch.getRevenueRecordIds());

        for (RevenueRecord record : records) {
            if (Objects.equals(record.getPayoutBatchId(), batch.getId())) {
                record.setStatus(RevenueRecordStatus.PAID);
                record.setPaidAt(now);
                record.setUpdatedAt(now);
            }
        }
        revenueRecordRepository.saveAll(records);

        return toPayoutResponses(List.of(savedBatch)).getFirst();
    }

    public String requireGuideIdByEmail(String email) {
        if (email == null || email.isBlank()) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Not authenticated");
        }

        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Authenticated guide not found"));

        if (user.getRole() != Role.GUIDE) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Only GUIDE can access this resource.");
        }

        return user.getId();
    }

    private PaymentAttempt findSucceededPaymentAttempt(String bookingId) {
        return paymentAttemptRepository
                .findFirstByBookingIdAndStatusOrderByCreatedAtDesc(
                        bookingId,
                        PaymentAttemptStatus.SUCCEEDED
                )
                .orElse(null);
    }

    private RevenueRecordStatus statusForBookingSession(RevenueRecord record) {
        ActivitySession session = record.getSessionId() == null
                ? null
                : activitySessionRepository.findById(record.getSessionId()).orElse(null);

        return session != null && session.getStatus() == ActivityStatus.COMPLETED
                ? RevenueRecordStatus.READY_FOR_PAYOUT
                : RevenueRecordStatus.PENDING_SESSION_COMPLETION;
    }

    private int calculateCommission(int grossAmountMinor) {
        return COMMISSION_RATE
                .multiply(BigDecimal.valueOf(Math.max(0, grossAmountMinor)))
                .setScale(0, RoundingMode.HALF_UP)
                .intValue();
    }

    private List<RevenueRecordResponse> toRevenueResponses(List<RevenueRecord> records) {
        if (records.isEmpty()) {
            return List.of();
        }

        Map<String, Booking> bookingsById = mapById(bookingRepository.findAllById(records.stream()
                .map(RevenueRecord::getBookingId)
                .filter(Objects::nonNull)
                .collect(Collectors.toSet())));
        Map<String, ActivitySession> sessionsById = mapById(activitySessionRepository.findAllById(records.stream()
                .map(RevenueRecord::getSessionId)
                .filter(Objects::nonNull)
                .collect(Collectors.toSet())));
        Map<String, ActivityTemplate> templatesById = mapById(activityTemplateRepository.findAllById(records.stream()
                .map(RevenueRecord::getTemplateId)
                .filter(Objects::nonNull)
                .collect(Collectors.toSet())));
        Map<String, User> guidesById = mapById(userRepository.findAllById(records.stream()
                .map(RevenueRecord::getGuideId)
                .filter(Objects::nonNull)
                .collect(Collectors.toSet())));

        return records.stream()
                .map(record -> {
                    Booking booking = bookingsById.get(record.getBookingId());
                    ActivitySession session = sessionsById.get(record.getSessionId());
                    ActivityTemplate template = templatesById.get(record.getTemplateId());
                    User guide = guidesById.get(record.getGuideId());

                    return new RevenueRecordResponse(
                            record.getId(),
                            record.getBookingId(),
                            record.getPaymentAttemptId(),
                            record.getSessionId(),
                            record.getTemplateId(),
                            template == null ? null : template.getTitle(),
                            record.getGuideId(),
                            displayName(guide),
                            guide == null ? null : guide.getEmail(),
                            record.getUserId(),
                            record.getGrossAmountMinor(),
                            record.getPlatformCommissionMinor(),
                            record.getGuidePayoutMinor(),
                            normalizeCurrency(record.getCurrency()),
                            record.getCommissionRate(),
                            record.getStatus() == null ? null : record.getStatus().name(),
                            booking == null ? null : booking.getCreatedAt(),
                            session == null ? null : session.getStartAt(),
                            record.getCreatedAt(),
                            record.getUpdatedAt(),
                            record.getSessionCompletedAt(),
                            record.getPayoutBatchId(),
                            record.getPaidAt()
                    );
                })
                .toList();
    }

    private List<PayoutBatchResponse> toPayoutResponses(List<PayoutBatch> batches) {
        if (batches.isEmpty()) {
            return List.of();
        }

        Map<String, User> guidesById = mapById(userRepository.findAllById(batches.stream()
                .map(PayoutBatch::getGuideId)
                .filter(Objects::nonNull)
                .collect(Collectors.toSet())));

        return batches.stream()
                .map(batch -> {
                    User guide = guidesById.get(batch.getGuideId());
                    return new PayoutBatchResponse(
                            batch.getId(),
                            batch.getGuideId(),
                            displayName(guide),
                            guide == null ? null : guide.getEmail(),
                            batch.getPeriodStart(),
                            batch.getPeriodEnd(),
                            batch.getTotalGrossMinor(),
                            batch.getTotalCommissionMinor(),
                            batch.getTotalPayoutMinor(),
                            normalizeCurrency(batch.getCurrency()),
                            safeList(batch.getRevenueRecordIds()).size(),
                            batch.getStatus() == null ? null : batch.getStatus().name(),
                            batch.getCreatedAt(),
                            batch.getUpdatedAt(),
                            batch.getPaidAt()
                    );
                })
                .toList();
    }

    private Instant weekStart(Instant instant) {
        return instant.atZone(ZoneOffset.UTC)
                .with(DayOfWeek.MONDAY)
                .truncatedTo(ChronoUnit.DAYS)
                .toInstant();
    }

    private String normalizeCurrency(String currency) {
        return currency == null || currency.isBlank()
                ? "TND"
                : currency.trim().toUpperCase();
    }

    private int sumGross(Collection<RevenueRecord> records) {
        return records.stream().mapToInt(record -> Math.max(0, record.getGrossAmountMinor())).sum();
    }

    private int sumCommission(Collection<RevenueRecord> records) {
        return records.stream().mapToInt(record -> Math.max(0, record.getPlatformCommissionMinor())).sum();
    }

    private int sumPayout(Collection<RevenueRecord> records) {
        return records.stream().mapToInt(record -> Math.max(0, record.getGuidePayoutMinor())).sum();
    }

    private int sumPayoutByStatus(Collection<RevenueRecord> records, RevenueRecordStatus status) {
        return records.stream()
                .filter(record -> record.getStatus() == status)
                .mapToInt(record -> Math.max(0, record.getGuidePayoutMinor()))
                .sum();
    }

    private long countByStatus(Collection<RevenueRecord> records, RevenueRecordStatus status) {
        return records.stream().filter(record -> record.getStatus() == status).count();
    }

    private <T> List<T> safeList(List<T> values) {
        return values == null ? List.of() : values;
    }

    private <T> Map<String, T> mapById(Iterable<T> values) {
        Map<String, T> result = new LinkedHashMap<>();
        for (T value : values) {
            String id = switch (value) {
                case Booking booking -> booking.getId();
                case ActivitySession session -> session.getId();
                case ActivityTemplate template -> template.getId();
                case User user -> user.getId();
                default -> null;
            };
            if (id != null) {
                result.put(id, value);
            }
        }
        return result;
    }

    private String displayName(User user) {
        if (user == null) {
            return null;
        }

        if (user.getUsername() != null && !user.getUsername().isBlank()) {
            return user.getUsername();
        }

        return user.getEmail();
    }
}

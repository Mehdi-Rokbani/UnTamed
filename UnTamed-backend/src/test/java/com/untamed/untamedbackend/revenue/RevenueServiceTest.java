package com.untamed.untamedbackend.revenue;

import com.untamed.untamedbackend.booking.Booking;
import com.untamed.untamedbackend.booking.BookingRepository;
import com.untamed.untamedbackend.booking.BookingStatus;
import com.untamed.untamedbackend.model.ActivitySession;
import com.untamed.untamedbackend.model.ActivityStatus;
import com.untamed.untamedbackend.model.Role;
import com.untamed.untamedbackend.model.User;
import com.untamed.untamedbackend.payment.PaymentAttempt;
import com.untamed.untamedbackend.payment.PaymentAttemptRepository;
import com.untamed.untamedbackend.payment.PaymentAttemptStatus;
import com.untamed.untamedbackend.repository.ActivitySessionRepository;
import com.untamed.untamedbackend.repository.ActivityTemplateRepository;
import com.untamed.untamedbackend.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class RevenueServiceTest {

    @Mock
    RevenueRecordRepository revenueRecordRepository;
    @Mock
    PayoutBatchRepository payoutBatchRepository;
    @Mock
    BookingRepository bookingRepository;
    @Mock
    PaymentAttemptRepository paymentAttemptRepository;
    @Mock
    ActivitySessionRepository activitySessionRepository;
    @Mock
    ActivityTemplateRepository activityTemplateRepository;
    @Mock
    UserRepository userRepository;

    RevenueService revenueService;

    @BeforeEach
    void setUp() {
        revenueService = new RevenueService(
                revenueRecordRepository,
                payoutBatchRepository,
                bookingRepository,
                paymentAttemptRepository,
                activitySessionRepository,
                activityTemplateRepository,
                userRepository
        );
    }

    @Test
    void duplicatePaymentCompletionDoesNotCreateDuplicateRevenueRecord() {
        Booking booking = paidBooking();
        PaymentAttempt attempt = succeededAttempt();
        ActivitySession session = session(ActivityStatus.PUBLISHED);
        RevenueRecord saved = RevenueRecord.builder().id("rr1").bookingId("booking1").build();

        when(revenueRecordRepository.findByBookingId("booking1"))
                .thenReturn(Optional.empty())
                .thenReturn(Optional.of(saved));
        when(bookingRepository.findById("booking1")).thenReturn(Optional.of(booking));
        when(paymentAttemptRepository.findFirstByBookingIdAndStatusOrderByCreatedAtDesc(
                "booking1", PaymentAttemptStatus.SUCCEEDED
        )).thenReturn(Optional.of(attempt));
        when(activitySessionRepository.findById("session1")).thenReturn(Optional.of(session));
        when(revenueRecordRepository.save(any(RevenueRecord.class))).thenAnswer(invocation -> invocation.getArgument(0));

        RevenueRecord first = revenueService.recordPaidBookingIfAbsent("booking1");
        RevenueRecord second = revenueService.recordPaidBookingIfAbsent("booking1");

        assertThat(first.getGrossAmountMinor()).isEqualTo(10000);
        assertThat(first.getPlatformCommissionMinor()).isEqualTo(1000);
        assertThat(first.getGuidePayoutMinor()).isEqualTo(9000);
        assertThat(second).isSameAs(saved);
        verify(revenueRecordRepository).save(any(RevenueRecord.class));
    }

    @Test
    void sessionCompletionCreatesMissingPaidRevenueAndMovesPendingRecordsReady() {
        Booking booking = paidBooking();
        PaymentAttempt attempt = succeededAttempt();
        ActivitySession completedSession = session(ActivityStatus.COMPLETED);
        RevenueRecord pending = RevenueRecord.builder()
                .id("rr-pending")
                .bookingId("booking-existing")
                .sessionId("session1")
                .status(RevenueRecordStatus.PENDING_SESSION_COMPLETION)
                .build();

        when(activitySessionRepository.findById("session1")).thenReturn(Optional.of(completedSession));
        when(bookingRepository.findBySessionIdAndStatus("session1", BookingStatus.COMPLETED)).thenReturn(List.of(booking));
        when(revenueRecordRepository.findByBookingId("booking1")).thenReturn(Optional.empty());
        when(bookingRepository.findById("booking1")).thenReturn(Optional.of(booking));
        when(paymentAttemptRepository.findFirstByBookingIdAndStatusOrderByCreatedAtDesc(
                "booking1", PaymentAttemptStatus.SUCCEEDED
        )).thenReturn(Optional.of(attempt));
        when(revenueRecordRepository.save(any(RevenueRecord.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(revenueRecordRepository.findBySessionIdAndStatus(
                "session1", RevenueRecordStatus.PENDING_SESSION_COMPLETION
        )).thenReturn(List.of(pending));

        revenueService.markSessionRevenueReady("session1");

        verify(revenueRecordRepository).save(any(RevenueRecord.class));
        assertThat(pending.getStatus()).isEqualTo(RevenueRecordStatus.READY_FOR_PAYOUT);
        assertThat(pending.getSessionCompletedAt()).isNotNull();
        verify(revenueRecordRepository).saveAll(List.of(pending));
    }

    @Test
    void unpaidCompletedBookingDoesNotGenerateRevenue() {
        when(revenueRecordRepository.findByBookingId("booking1")).thenReturn(Optional.empty());
        when(bookingRepository.findById("booking1")).thenReturn(Optional.of(paidBooking()));
        when(paymentAttemptRepository.findFirstByBookingIdAndStatusOrderByCreatedAtDesc(
                "booking1", PaymentAttemptStatus.SUCCEEDED
        )).thenReturn(Optional.empty());

        RevenueRecord result = revenueService.recordPaidBookingIfAbsent("booking1");

        assertThat(result).isNull();
        verify(revenueRecordRepository, never()).save(any(RevenueRecord.class));
    }

    @Test
    void weeklyPayoutBatchingDoesNotBatchAlreadyScheduledRecordsAgain() {
        RevenueRecord ready = RevenueRecord.builder()
                .id("rr1")
                .guideId("guide1")
                .currency("TND")
                .grossAmountMinor(10000)
                .platformCommissionMinor(1000)
                .guidePayoutMinor(9000)
                .status(RevenueRecordStatus.READY_FOR_PAYOUT)
                .build();

        when(revenueRecordRepository.findByStatus(RevenueRecordStatus.READY_FOR_PAYOUT))
                .thenReturn(List.of(ready))
                .thenReturn(List.of());
        when(payoutBatchRepository.save(any(PayoutBatch.class))).thenAnswer(invocation -> {
            PayoutBatch batch = invocation.getArgument(0);
            batch.setId("batch1");
            return batch;
        });
        when(userRepository.findAllById(any())).thenReturn(List.of());

        List<PayoutBatchResponse> first = revenueService.createWeeklyPayoutBatches();
        List<PayoutBatchResponse> second = revenueService.createWeeklyPayoutBatches();

        assertThat(first).hasSize(1);
        assertThat(second).isEmpty();
        assertThat(ready.getStatus()).isEqualTo(RevenueRecordStatus.PAYOUT_SCHEDULED);
        assertThat(ready.getPayoutBatchId()).isEqualTo("batch1");
        verify(payoutBatchRepository).save(any(PayoutBatch.class));
    }

    @Test
    void markingPayoutPaidMarksRelatedRevenueRecordsPaid() {
        PayoutBatch batch = PayoutBatch.builder()
                .id("batch1")
                .guideId("guide1")
                .status(PayoutBatchStatus.CREATED)
                .revenueRecordIds(List.of("rr1"))
                .build();
        RevenueRecord record = RevenueRecord.builder()
                .id("rr1")
                .payoutBatchId("batch1")
                .status(RevenueRecordStatus.PAYOUT_SCHEDULED)
                .build();

        when(payoutBatchRepository.findById("batch1")).thenReturn(Optional.of(batch));
        when(payoutBatchRepository.save(any(PayoutBatch.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(revenueRecordRepository.findByIdIn(List.of("rr1"))).thenReturn(List.of(record));
        when(userRepository.findAllById(any())).thenReturn(List.of());

        PayoutBatchResponse response = revenueService.markPayoutBatchPaid("batch1");

        assertThat(response.status()).isEqualTo("PAID");
        assertThat(batch.getPaidAt()).isNotNull();
        assertThat(record.getStatus()).isEqualTo(RevenueRecordStatus.PAID);
        assertThat(record.getPaidAt()).isNotNull();
        verify(revenueRecordRepository).saveAll(List.of(record));
    }

    @Test
    void fullRefundVoidsRevenueBeforePayout() {
        RevenueRecord record = revenueRecord(RevenueRecordStatus.READY_FOR_PAYOUT);
        when(revenueRecordRepository.findByBookingId("booking1")).thenReturn(Optional.of(record));
        when(paymentAttemptRepository.findFirstByBookingIdAndStatusOrderByCreatedAtDesc(
                "booking1", PaymentAttemptStatus.SUCCEEDED
        )).thenReturn(Optional.of(succeededAttempt()));
        when(revenueRecordRepository.save(any(RevenueRecord.class))).thenAnswer(invocation -> invocation.getArgument(0));

        RevenueRecord adjusted = revenueService.applyRefundAdjustment("booking1", 10000);

        assertThat(adjusted.getStatus()).isEqualTo(RevenueRecordStatus.VOIDED);
        assertThat(adjusted.getGrossAmountMinor()).isZero();
        assertThat(adjusted.getPlatformCommissionMinor()).isZero();
        assertThat(adjusted.getGuidePayoutMinor()).isZero();
    }

    @Test
    void partialRefundRecalculatesRevenueFromOriginalPaidAmountIdempotently() {
        RevenueRecord record = revenueRecord(RevenueRecordStatus.PENDING_SESSION_COMPLETION);
        when(revenueRecordRepository.findByBookingId("booking1")).thenReturn(Optional.of(record));
        when(paymentAttemptRepository.findFirstByBookingIdAndStatusOrderByCreatedAtDesc(
                "booking1", PaymentAttemptStatus.SUCCEEDED
        )).thenReturn(Optional.of(succeededAttempt()));
        when(revenueRecordRepository.save(any(RevenueRecord.class))).thenAnswer(invocation -> invocation.getArgument(0));

        RevenueRecord first = revenueService.applyRefundAdjustment("booking1", 5000);
        RevenueRecord second = revenueService.applyRefundAdjustment("booking1", 5000);

        assertThat(first.getStatus()).isEqualTo(RevenueRecordStatus.PENDING_SESSION_COMPLETION);
        assertThat(first.getGrossAmountMinor()).isEqualTo(5000);
        assertThat(first.getPlatformCommissionMinor()).isEqualTo(500);
        assertThat(first.getGuidePayoutMinor()).isEqualTo(4500);
        assertThat(second.getGrossAmountMinor()).isEqualTo(5000);
        assertThat(second.getPlatformCommissionMinor()).isEqualTo(500);
        assertThat(second.getGuidePayoutMinor()).isEqualTo(4500);
    }

    @Test
    void scheduledRevenueCannotBeRefundAdjustedAutomatically() {
        RevenueRecord record = revenueRecord(RevenueRecordStatus.PAYOUT_SCHEDULED);
        record.setPayoutBatchId("batch1");
        when(revenueRecordRepository.findByBookingId("booking1")).thenReturn(Optional.of(record));

        assertThatThrownBy(() -> revenueService.assertBookingRevenueRefundAdjustable("booking1"))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("409");
        verify(revenueRecordRepository, never()).save(any(RevenueRecord.class));
    }

    @Test
    void paidRevenueCannotBeRefundAdjustedAutomatically() {
        RevenueRecord record = revenueRecord(RevenueRecordStatus.PAID);
        when(revenueRecordRepository.findByBookingId("booking1")).thenReturn(Optional.of(record));

        assertThatThrownBy(() -> revenueService.applyRefundAdjustment("booking1", 10000))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("409");
        verify(revenueRecordRepository, never()).save(any(RevenueRecord.class));
    }

    @Test
    void nonGuideCannotResolveGuideRevenueScope() {
        User adventurer = User.builder()
                .id("user1")
                .email("user@example.com")
                .role(Role.ADVENTURER)
                .build();
        when(userRepository.findByEmail("user@example.com")).thenReturn(Optional.of(adventurer));

        assertThatThrownBy(() -> revenueService.requireGuideIdByEmail("user@example.com"))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("403");
    }

    private Booking paidBooking() {
        return Booking.builder()
                .id("booking1")
                .userId("user1")
                .sessionId("session1")
                .status(BookingStatus.COMPLETED)
                .createdAt(Instant.now())
                .build();
    }

    private PaymentAttempt succeededAttempt() {
        return PaymentAttempt.builder()
                .id("payment1")
                .bookingId("booking1")
                .status(PaymentAttemptStatus.SUCCEEDED)
                .amount(10000)
                .currency("TND")
                .build();
    }

    private ActivitySession session(ActivityStatus status) {
        return ActivitySession.builder()
                .id("session1")
                .templateId("template1")
                .guideId("guide1")
                .status(status)
                .build();
    }

    private RevenueRecord revenueRecord(RevenueRecordStatus status) {
        return RevenueRecord.builder()
                .id("rr1")
                .bookingId("booking1")
                .paymentAttemptId("payment1")
                .sessionId("session1")
                .guideId("guide1")
                .grossAmountMinor(10000)
                .platformCommissionMinor(1000)
                .guidePayoutMinor(9000)
                .currency("TND")
                .status(status)
                .build();
    }
}

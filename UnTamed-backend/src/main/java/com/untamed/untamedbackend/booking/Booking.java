package com.untamed.untamedbackend.booking;

import lombok.*;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.index.CompoundIndexes;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;
import org.springframework.data.mongodb.core.mapping.Field;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@Document(collection = "bookings")
@CompoundIndexes({
        @CompoundIndex(name = "idx_user_created", def = "{'userId': 1, 'createdAt': -1}"),
        @CompoundIndex(name = "idx_user_status_created", def = "{'userId': 1, 'status': 1, 'createdAt': -1}"),
        @CompoundIndex(name = "idx_session_status_created", def = "{'sessionId': 1, 'status': 1, 'createdAt': 1}")
})
public class Booking {

    @Id
    private String id;

    @Indexed
    private String userId;

    @Indexed
    private String sessionId;

    private int numberOfPeople;

    @Builder.Default
    private List<String> guestNames = new ArrayList<>();

    @Indexed
    private BookingStatus status;

    private Instant createdAt;
    private Instant updatedAt;

    // only relevant for PENDING
    private Instant expiresAt;


    @Builder.Default
    @Field("attendance_marked_absent")
    private boolean attendanceMarkedAbsent = false;

    @Field("attendance_marked_at")
    private Instant attendanceMarkedAt;

    @Field("attendance_marked_by_guide_id")
    private String attendanceMarkedByGuideId;

    // Refund / cancellation metadata
    @Builder.Default
    private RefundStatus refundStatus = RefundStatus.NONE;

    @Builder.Default
    private int refundPercent = 0;

    @Builder.Default
    private int refundAmount = 0;

    private String refundCurrency;

    private String stripeRefundId;

    private CancelledBy cancelledBy;

    private String cancellationReason;

    private Instant cancelledAt;
}

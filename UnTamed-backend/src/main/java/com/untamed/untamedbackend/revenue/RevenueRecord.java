package com.untamed.untamedbackend.revenue;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.index.CompoundIndexes;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.math.BigDecimal;
import java.time.Instant;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@Document(collection = "revenue_records")
@CompoundIndexes({
        @CompoundIndex(name = "idx_guide_status_created", def = "{'guideId': 1, 'status': 1, 'createdAt': -1}"),
        @CompoundIndex(name = "idx_status_guide_currency", def = "{'status': 1, 'guideId': 1, 'currency': 1}"),
        @CompoundIndex(name = "idx_session_status", def = "{'sessionId': 1, 'status': 1}")
})
public class RevenueRecord {

    @Id
    private String id;

    @Indexed(unique = true)
    private String bookingId;

    @Indexed
    private String paymentAttemptId;

    @Indexed
    private String sessionId;

    @Indexed
    private String templateId;

    @Indexed
    private String guideId;

    @Indexed
    private String userId;

    private int grossAmountMinor;
    private int platformCommissionMinor;
    private int guidePayoutMinor;
    private String currency;
    private BigDecimal commissionRate;

    @Indexed
    private RevenueRecordStatus status;

    private Instant createdAt;
    private Instant updatedAt;
    private Instant sessionCompletedAt;

    @Indexed
    private String payoutBatchId;

    private Instant paidAt;
}

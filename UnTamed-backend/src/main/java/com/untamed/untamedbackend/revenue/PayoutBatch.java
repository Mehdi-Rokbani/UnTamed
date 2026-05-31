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

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@Document(collection = "payout_batches")
@CompoundIndexes({
        @CompoundIndex(name = "idx_guide_created", def = "{'guideId': 1, 'createdAt': -1}"),
        @CompoundIndex(name = "idx_status_created", def = "{'status': 1, 'createdAt': -1}")
})
public class PayoutBatch {

    @Id
    private String id;

    @Indexed
    private String guideId;

    private Instant periodStart;
    private Instant periodEnd;

    private int totalGrossMinor;
    private int totalCommissionMinor;
    private int totalPayoutMinor;
    private String currency;

    @Builder.Default
    private List<String> revenueRecordIds = new ArrayList<>();

    @Indexed
    private PayoutBatchStatus status;

    private Instant createdAt;
    private Instant updatedAt;
    private Instant paidAt;
}

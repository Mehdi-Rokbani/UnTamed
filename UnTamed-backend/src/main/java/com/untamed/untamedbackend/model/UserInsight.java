package com.untamed.untamedbackend.model;

import lombok.*;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Map;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@Document(collection = "user_insights")
public class UserInsight {

    @Id
    private String id;

    private String userId;

    // Basic counters
    private int totalBookings;
    private int confirmedBookings;
    private int completedTrips;
    private int cancelledBookings;
    private int reviewsWrittenCount;

    // Preference signals
    private List<String> topCategoryIds;
    private Map<String, Integer> categoryScores;

    private Map<String, Integer> difficultyScores;
    private Map<String, Integer> priceRangeScores;
    private Map<String, Integer> governorateScores;

    // Behavior summary
    private BigDecimal avgBookedPrice;
    private BigDecimal minBookedPrice;
    private BigDecimal maxBookedPrice;

    private Instant lastBookingAt;
    private Instant lastCompletedTripAt;
    private Instant lastReviewAt;
    private Instant updatedAt;


    private String embeddingProfileText;
    private List<Double> embeddingVector;
    private Instant embeddingUpdatedAt;
}
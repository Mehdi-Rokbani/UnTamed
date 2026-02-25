package com.untamed.untamedbackend.booking;

import lombok.*;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@Document(collection = "bookings")
public class Booking {

    @Id
    private String id;

    @Indexed
    private String userId;

    @Indexed
    private String sessionId;

    private int numberOfPeople;

    @Indexed
    private BookingStatus status;

    private Instant createdAt;
    private Instant updatedAt;

    // only relevant for PENDING
    private Instant expiresAt;

    // for later payment/refund integration (works now as metadata)
    @Builder.Default
    private int refundSeatsRequested = 0;

    @Builder.Default
    private boolean refundRequested = false;
}
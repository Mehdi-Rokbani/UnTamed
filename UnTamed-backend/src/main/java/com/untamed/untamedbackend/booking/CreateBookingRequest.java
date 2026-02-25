package com.untamed.untamedbackend.booking;

import lombok.*;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CreateBookingRequest {
    private String sessionId;
    private int numberOfPeople;
}
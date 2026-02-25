package com.untamed.untamedbackend.booking;

import lombok.*;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CancelBookingResponse {
    private String bookingId;
    private BookingStatus status;
}
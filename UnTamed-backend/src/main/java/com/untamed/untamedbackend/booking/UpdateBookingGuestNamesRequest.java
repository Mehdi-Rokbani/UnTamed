package com.untamed.untamedbackend.booking;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.ArrayList;
import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class UpdateBookingGuestNamesRequest {
    @Builder.Default
    private List<String> guestNames = new ArrayList<>();
}

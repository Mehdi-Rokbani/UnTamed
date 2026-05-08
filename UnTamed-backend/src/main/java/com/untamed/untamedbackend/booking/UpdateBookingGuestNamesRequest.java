package com.untamed.untamedbackend.booking;

import jakarta.validation.constraints.NotEmpty;

import java.util.List;

public record UpdateBookingGuestNamesRequest(
        @NotEmpty List<String> guestNames
) {
}

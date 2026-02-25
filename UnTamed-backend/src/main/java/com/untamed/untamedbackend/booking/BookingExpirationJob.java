package com.untamed.untamedbackend.booking;

import lombok.RequiredArgsConstructor;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.List;

@Component
@RequiredArgsConstructor
public class BookingExpirationJob {

    private final BookingRepository bookingRepository;
    private final BookingService bookingService;

    // every 1 minute
    @Scheduled(fixedDelay = 60000)
    public void expirePending() {
        List<Booking> expired = bookingRepository.findByStatusAndExpiresAtBefore(
                BookingStatus.PENDING,
                Instant.now()
        );

        for (Booking b : expired) {
            bookingService.expireBooking(b.getId());
        }
    }
}
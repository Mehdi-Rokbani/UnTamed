package com.untamed.untamedbackend.booking;

import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.List;

@Component
@RequiredArgsConstructor
public class BookingExpirationJob {

    private static final Logger log = LoggerFactory.getLogger(BookingExpirationJob.class);

    private final BookingRepository bookingRepository;
    private final BookingService bookingService;

    @Value("${app.jobs.booking-expiration.enabled:true}")
    private boolean enabled;

    // every 1 minute
    @Scheduled(
            fixedDelayString = "${app.jobs.booking-expiration.fixed-delay-ms:60000}",
            initialDelayString = "${app.jobs.booking-expiration.initial-delay-ms:60000}"
    )
    public void expirePending() {
        if (!enabled) {
            return;
        }

        try {
            List<Booking> expired = bookingRepository.findByStatusAndExpiresAtBefore(
                    BookingStatus.PENDING,
                    Instant.now()
            );

            for (Booking b : expired) {
                bookingService.expireBooking(b.getId());
            }
        } catch (RuntimeException e) {
            log.warn("Skipping pending booking expiration run because MongoDB is currently unavailable.", e);
        }
    }
}

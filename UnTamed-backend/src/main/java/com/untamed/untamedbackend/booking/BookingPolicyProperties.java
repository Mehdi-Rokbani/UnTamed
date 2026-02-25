package com.untamed.untamedbackend.booking;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

@Data
@Component
@ConfigurationProperties(prefix = "untamed.booking")
public class BookingPolicyProperties {
    private long cutoffHours;     // 5
    private long refundHours;     // 48
    private long pendingMinutes;  // 15
}
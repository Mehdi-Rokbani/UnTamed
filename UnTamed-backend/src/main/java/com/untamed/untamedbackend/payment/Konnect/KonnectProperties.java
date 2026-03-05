package com.untamed.untamedbackend.payment.Konnect;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;

@Data
@ConfigurationProperties(prefix = "konnect")
public class KonnectProperties {
    private String baseUrl;
    private String apiKey;
    private String receiverWalletId;

    private String token = "TND";
    private int defaultLifespanMinutes = 15;

    private String webhookUrl;
    private String successUrl;
    private String failUrl;
}
package com.untamed.untamedbackend.payment.stripe;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;

@Data
@ConfigurationProperties(prefix = "stripe")
public class StripeProperties {

    private String secretKey;
    private String webhookSecret;

    private String successUrl;
    private String cancelUrl;
    private String currency;

}

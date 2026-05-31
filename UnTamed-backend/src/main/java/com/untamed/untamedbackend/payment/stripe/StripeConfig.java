package com.untamed.untamedbackend.payment.stripe;

import com.stripe.Stripe;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.annotation.Configuration;
import org.springframework.boot.context.properties.EnableConfigurationProperties;

@Configuration
@EnableConfigurationProperties(StripeProperties.class)
@RequiredArgsConstructor
public class StripeConfig {

    private static final Logger log = LoggerFactory.getLogger(StripeConfig.class);

    private final StripeProperties props;

    @PostConstruct
    public void init() {
        Stripe.apiKey = props.getSecretKey();

        log.info("Stripe secret key configured: {}", hasText(props.getSecretKey()));
        log.info("Stripe webhook secret configured: {}", hasText(props.getWebhookSecret()));
        log.info("Stripe currency: {}", hasText(props.getCurrency()) ? props.getCurrency() : "eur");
    }

    private boolean hasText(String value) {
        return value != null && !value.isBlank();
    }
}

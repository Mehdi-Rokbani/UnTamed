package com.untamed.untamedbackend.payment.stripe;

import com.stripe.Stripe;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Configuration;
import org.springframework.boot.context.properties.EnableConfigurationProperties;

@Configuration
@EnableConfigurationProperties(StripeProperties.class)
@RequiredArgsConstructor
public class StripeConfig {

    private final StripeProperties props;

    @PostConstruct
    public void init() {
        Stripe.apiKey = props.getSecretKey();
    }
}
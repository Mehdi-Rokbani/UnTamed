package com.untamed.untamedbackend.payment.konnect;

import com.untamed.untamedbackend.payment.Konnect_disabled.KonnectInitRequest;
import com.untamed.untamedbackend.payment.Konnect_disabled.KonnectInitResponse;
import com.untamed.untamedbackend.payment.Konnect_disabled.KonnectPaymentDetailsResponse;
import com.untamed.untamedbackend.payment.Konnect_disabled.KonnectProperties;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.reactive.function.client.WebClient;

@Component
@RequiredArgsConstructor
public class KonnectClient {

    private final KonnectProperties props;

    private WebClient client() {
        System.out.println("BASE URL = " + props.getBaseUrl());
        return WebClient.builder()
                .baseUrl(props.getBaseUrl())
                .defaultHeader("x-api-key", props.getApiKey())
                .defaultHeader(HttpHeaders.CONTENT_TYPE, MediaType.APPLICATION_JSON_VALUE)
                .build();
    }

    public KonnectInitResponse initPayment(KonnectInitRequest req) {
        return client()
                .post()
                .uri("/payments/init-payment")
                .bodyValue(req)
                .retrieve()
                .bodyToMono(KonnectInitResponse.class)
                .block();
    }

    public KonnectPaymentDetailsResponse getPaymentDetails(String paymentRef) {
        return client()
                .get()
                .uri("/payments/{id}", paymentRef)
                .retrieve()
                .bodyToMono(KonnectPaymentDetailsResponse.class)
                .block();
    }
}
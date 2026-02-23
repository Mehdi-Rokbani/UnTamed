package com.untamed.untamedbackend.integrations.email;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestTemplate;

import java.util.List;
import java.util.Map;

@Component
public class BrevoEmailSender implements EmailSender {

    private final RestTemplate restTemplate = new RestTemplate();

    private final String apiKey;
    private final String fromEmail;
    private final String fromName;

    public BrevoEmailSender(
            @Value("${brevo.apiKey}") String apiKey,
            @Value("${app.mailFromEmail}") String fromEmail,
            @Value("${app.mailFromName:UnTamed}") String fromName
    ) {
        this.apiKey = apiKey;
        this.fromEmail = fromEmail;
        this.fromName = fromName;
    }

    @Override
    public void send(String toEmail, String subject, String body) {
        // Brevo endpoint: POST /v3/smtp/email :contentReference[oaicite:3]{index=3}
        String url = "https://api.brevo.com/v3/smtp/email";

        Map<String, Object> payload = Map.of(
                "sender", Map.of("email", fromEmail, "name", fromName),
                "to", List.of(Map.of("email", toEmail)),
                "subject", subject,
                "textContent", body
        );

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.setAccept(List.of(MediaType.APPLICATION_JSON));

        // Brevo auth header name is `api-key` :contentReference[oaicite:4]{index=4}
        headers.set("api-key", apiKey);

        HttpEntity<Map<String, Object>> req = new HttpEntity<>(payload, headers);

        ResponseEntity<String> res = restTemplate.exchange(url, HttpMethod.POST, req, String.class);

        if (!res.getStatusCode().is2xxSuccessful()) {
            throw new IllegalStateException("Brevo send failed: " + res.getStatusCode());
        }
    }
}

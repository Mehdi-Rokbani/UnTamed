package com.untamed.untamedbackend.recommendation.n8n;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.util.Map;

@Service
public class N8nWebhookServiceImpl implements N8nWebhookService {

    private final RestTemplate restTemplate = new RestTemplate();
    @Value("${app.n8n.webhooks.user-embedding}")
    private String userEmbeddingUrl;

    @Value("${app.n8n.webhooks.template-embedding}")
    private String url;

    @Override
    public void triggerTemplateEmbedding(String templateId) {
        try {
            restTemplate.postForEntity(
                    url,
                    Map.of("templateId", templateId),
                    String.class
            );
        } catch (Exception e) {
            // do NOT break business logic if AI fails
            System.out.println("n8n webhook failed: " + e.getMessage());
        }
    }
    @Override
    public void triggerUserEmbedding(String userId) {
        try {
            restTemplate.postForEntity(
                    userEmbeddingUrl,
                    Map.of("userId", userId),
                    String.class
            );
        } catch (Exception e) {
            System.out.println("n8n user webhook failed: " + e.getMessage());
        }
    }


}
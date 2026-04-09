package com.untamed.untamedbackend.recommendation.n8n;

public interface N8nWebhookService {
    void triggerTemplateEmbedding(String templateId);
    void triggerUserEmbedding(String userId);
}
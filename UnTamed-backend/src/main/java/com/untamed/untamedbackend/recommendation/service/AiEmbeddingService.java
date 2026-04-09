package com.untamed.untamedbackend.recommendation.service;

import com.untamed.untamedbackend.recommendation.dto.TemplateEmbeddingPayload;
import com.untamed.untamedbackend.recommendation.dto.UpdateTemplateEmbeddingRequest;
import com.untamed.untamedbackend.recommendation.dto.UpdateUserEmbeddingRequest;
import com.untamed.untamedbackend.recommendation.dto.UserEmbeddingPayload;

public interface AiEmbeddingService {
    TemplateEmbeddingPayload getTemplateEmbeddingPayload(String templateId);
    void updateTemplateEmbedding(String templateId, UpdateTemplateEmbeddingRequest request);

    UserEmbeddingPayload getUserEmbeddingPayload(String userId);
    void updateUserEmbedding(String userId, UpdateUserEmbeddingRequest request);
}
package com.untamed.untamedbackend.recommendation.service;

import com.untamed.untamedbackend.recommendation.dto.RecommendationItemResponse;

import java.util.List;

public interface SimilarActivityService {
    List<RecommendationItemResponse> findSimilar(String templateId, int limit);
}
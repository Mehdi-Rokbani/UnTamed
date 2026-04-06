package com.untamed.untamedbackend.recommendation.service;

import com.untamed.untamedbackend.recommendation.dto.RecommendationItemResponse;

import java.util.List;

public interface RecommendationService {
    List<RecommendationItemResponse> getRecommendationsForUser(String userId, int limit);
}
package com.untamed.untamedbackend.recommendation.controller;

import com.untamed.untamedbackend.booking.BookingService;
import com.untamed.untamedbackend.recommendation.dto.RecommendationItemResponse;
import com.untamed.untamedbackend.recommendation.service.RecommendationService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import org.springframework.security.core.Authentication;
import java.util.List;

@RestController
@RequestMapping("/api/recommendations")
@RequiredArgsConstructor
public class RecommendationController {

    private final RecommendationService recommendationService;
    private final BookingService bookingService;

    @GetMapping("/me")
    public List<RecommendationItemResponse> getMine(
            Authentication auth,
            @RequestParam(defaultValue = "10") int limit
    ) {
        String userId = bookingService.requireAuthenticatedDbUserId(auth);
        return recommendationService.getRecommendationsForUser(userId, limit);
    }
}
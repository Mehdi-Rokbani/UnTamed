package com.untamed.untamedbackend.recommendation.controller;

import com.untamed.untamedbackend.recommendation.dto.RecommendationItemResponse;
import com.untamed.untamedbackend.recommendation.service.SimilarActivityService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/templates")
@RequiredArgsConstructor
public class SimilarActivityController {

    private final SimilarActivityService similarActivityService;

    @GetMapping("/{id}/similar")
    public List<RecommendationItemResponse> getSimilarActivities(
            @PathVariable("id") String templateId,
            @RequestParam(defaultValue = "4") int limit
    ) {
        return similarActivityService.findSimilar(templateId, limit);
    }
}
package com.untamed.untamedbackend.smartsearch.controller;

import com.untamed.untamedbackend.recommendation.dto.RecommendationItemResponse;
import com.untamed.untamedbackend.smartsearch.dto.SmartSearchRequest;
import com.untamed.untamedbackend.smartsearch.service.SmartSearchService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/search")
@RequiredArgsConstructor
public class SmartSearchController {

    private final SmartSearchService smartSearchService;

    @PostMapping("/semantic")
    public List<RecommendationItemResponse> semanticSearch(
            @Valid @RequestBody SmartSearchRequest request
    ) {
        return smartSearchService.search(request);
    }
}
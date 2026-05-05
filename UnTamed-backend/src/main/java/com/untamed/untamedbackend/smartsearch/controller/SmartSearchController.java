package com.untamed.untamedbackend.smartsearch.controller;

import com.untamed.untamedbackend.smartsearch.dto.SmartSearchRequest;
import com.untamed.untamedbackend.smartsearch.service.SmartSearchService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/search")
@RequiredArgsConstructor
public class SmartSearchController {

    private final SmartSearchService smartSearchService;

    @PostMapping("/semantic")
    public Object semanticSearch(
            @Valid @RequestBody SmartSearchRequest request,
            @RequestParam(required = false) Integer page,
            @RequestParam(required = false) Integer size
    ) {
        if (page == null && size == null) {
            return smartSearchService.search(request);
        }

        return smartSearchService.searchPage(request, resolvePage(page), resolveSize(size, 12));
    }

    private int resolvePage(Integer page) {
        return page == null ? 0 : Math.max(0, page);
    }

    private int resolveSize(Integer size, int defaultSize) {
        return size == null ? defaultSize : Math.max(1, Math.min(size, 50));
    }
}

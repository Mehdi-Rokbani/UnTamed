package com.untamed.untamedbackend.controller;

import com.untamed.untamedbackend.dto.PublicSessionDto;
import com.untamed.untamedbackend.dto.PublicTemplateCardResponse;
import com.untamed.untamedbackend.dto.TemplateSearchCriteria;
import com.untamed.untamedbackend.model.Difficulty;
import com.untamed.untamedbackend.service.ActivityTemplatePublicService;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.util.List;

@RestController
@RequestMapping("/api/templates/public")
public class ActivityTemplatePublicController {

    private final ActivityTemplatePublicService publicService;

    public ActivityTemplatePublicController(ActivityTemplatePublicService publicService) {
        this.publicService = publicService;
    }

    @GetMapping
    public List<PublicTemplateCardResponse> list() {
        return publicService.list();
    }

    @GetMapping("/search")
    public List<PublicTemplateCardResponse> search(
            @RequestParam(required = false) String q,
            @RequestParam(required = false) String addressId,
            @RequestParam(required = false) List<String> categoryIds,
            @RequestParam(required = false) Double minPrice,
            @RequestParam(required = false) Double maxPrice,
            @RequestParam(required = false) Difficulty difficulty,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) Instant dateFrom,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) Instant dateTo,
            @RequestParam(required = false, defaultValue = "popular") String sort
    ) {
        return publicService.search(new TemplateSearchCriteria(
                q,
                addressId,
                categoryIds,
                minPrice,
                maxPrice,
                difficulty,
                dateFrom,
                dateTo,
                sort
        ));
    }

    @GetMapping("/{id}")
    public PublicTemplateCardResponse get(@PathVariable String id) {
        return publicService.get(id);
    }

    @GetMapping("/{id}/sessions")
    public List<PublicSessionDto> listSessions(@PathVariable String id) {
        return publicService.listUpcomingSessions(id);
    }
}
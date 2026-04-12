package com.untamed.untamedbackend.smartsearch.service;

import com.untamed.untamedbackend.model.ActivityTemplate;
import com.untamed.untamedbackend.repository.ActivityTemplateRepository;
import com.untamed.untamedbackend.smartsearch.SearchIntent;
import com.untamed.untamedbackend.smartsearch.SearchIntentResolver;
import com.untamed.untamedbackend.smartsearch.TemplateSearchScorer;
import com.untamed.untamedbackend.smartsearch.dto.TemplateSearchCriteria;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.Comparator;
import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class TemplateSearchService {

    private final ActivityTemplateRepository activityTemplateRepository;
    private final SearchIntentResolver searchIntentResolver;
    private final TemplateSearchScorer templateSearchScorer;

    public List<ActivityTemplate> searchTemplates(TemplateSearchCriteria criteria) {
        List<ActivityTemplate> base = activityTemplateRepository.searchByCriteria(
                criteria.getQ(),
                criteria.getCategoryId(),
                criteria.getDifficulty(),
                criteria.getMinPrice(),
                criteria.getMaxPrice(),
                criteria.getAddressId()
        );

        SearchIntent intent = searchIntentResolver.resolve(criteria.getQ());

        List<ActivityTemplate> filtered = base;
        if (criteria.isStrictIntentFiltering() && intent != SearchIntent.NONE) {
            filtered = base.stream()
                    .filter(t -> templateSearchScorer.matchesIntent(t, intent))
                    .collect(Collectors.toList());
        }

        return filtered.stream()
                .map(t -> new ScoredTemplate(
                        t,
                        templateSearchScorer.score(t, criteria.getQ(), intent, getSemanticScoreOrZero(t, criteria.getQ()))
                ))
                .sorted(Comparator.comparingDouble(ScoredTemplate::score).reversed())
                .map(ScoredTemplate::template)
                .collect(Collectors.toList());
    }

    private double getSemanticScoreOrZero(ActivityTemplate template, String query) {
        // Replace this with your real embedding similarity.
        // Important: do NOT let this dominate the ranking.
        return 0.0;
    }

    private record ScoredTemplate(ActivityTemplate template, double score) {}
}
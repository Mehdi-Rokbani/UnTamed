package com.untamed.untamedbackend.smartsearch;

import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Locale;
import java.util.Map;

@Component
public class SearchIntentResolver {

    private static final Map<SearchIntent, List<String>> KEYWORDS = Map.of(
            SearchIntent.WATER, List.of(
                    "water", "sea", "ocean", "beach", "diving", "scuba", "snorkeling", "snorkelling",
                    "kayak", "kayaking", "paddle", "boat", "swimming", "underwater", "marine"
            ),
            SearchIntent.HIKING, List.of(
                    "hike", "hiking", "trek", "trekking", "trail", "mountain", "walk", "randonnee", "randonnée"
            ),
            SearchIntent.CYCLING, List.of(
                    "bike", "biking", "cycling", "bicycle", "velo", "vélo", "mtb"
            ),
            SearchIntent.CAMPING, List.of(
                    "camp", "camping", "tent", "bivouac"
            ),
            SearchIntent.CLIMBING, List.of(
                    "climb", "climbing", "escalade", "rock climbing"
            ),
            SearchIntent.HORSE_RIDING, List.of(
                    "horse", "horse riding", "equitation", "équitation", "riding"
            ),
            SearchIntent.DESERT, List.of(
                    "desert", "sahara", "dune", "camel", "quad"
            )
    );

    public SearchIntent resolve(String query) {
        if (query == null || query.isBlank()) {
            return SearchIntent.NONE;
        }

        String q = query.toLowerCase(Locale.ROOT);

        for (var entry : KEYWORDS.entrySet()) {
            for (String keyword : entry.getValue()) {
                if (q.contains(keyword.toLowerCase(Locale.ROOT))) {
                    return entry.getKey();
                }
            }
        }

        return SearchIntent.NONE;
    }
}
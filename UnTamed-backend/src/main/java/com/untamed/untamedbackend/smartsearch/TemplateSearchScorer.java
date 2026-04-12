package com.untamed.untamedbackend.smartsearch;

import com.untamed.untamedbackend.model.ActivityTemplate;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Locale;

@Component
public class TemplateSearchScorer {

    public double score(ActivityTemplate template, String query, SearchIntent intent, double semanticScore) {
        double score = 0.0;

        String q = query == null ? "" : query.toLowerCase(Locale.ROOT);

        String title = safe(template.getTitle());
        String description = safe(template.getDescription());
        String tags = String.join(" ", safeList(template.getTags())).toLowerCase(Locale.ROOT);
        String hints = String.join(" ", safeList(template.getSemanticHints())).toLowerCase(Locale.ROOT);

        boolean titleMatch = !q.isBlank() && title.contains(q);
        boolean descMatch = !q.isBlank() && description.contains(q);
        boolean tagsMatch = !q.isBlank() && tags.contains(q);
        boolean hintsMatch = !q.isBlank() && hints.contains(q);

        if (titleMatch) score += 120;
        if (tagsMatch) score += 80;
        if (hintsMatch) score += 70;
        if (descMatch) score += 45;

        boolean strongIntentMatch = matchesIntent(template, intent);
        if (intent != SearchIntent.NONE && strongIntentMatch) {
            score += 200;
        }

        // semantic score should be bonus only
        score += Math.max(0, semanticScore) * 50.0;

        if (template.getRatingAverage() != null) {
            score += template.getRatingAverage() * 5.0;
        }
        if (template.getRatingCount() != null) {
            score += Math.min(template.getRatingCount(), 50);
        }

        return score;
    }

    public boolean matchesIntent(ActivityTemplate template, SearchIntent intent) {
        if (intent == SearchIntent.NONE) return true;

        String blob = (
                safe(template.getTitle()) + " " +
                        safe(template.getDescription()) + " " +
                        String.join(" ", safeList(template.getTags())) + " " +
                        String.join(" ", safeList(template.getSemanticHints()))
        ).toLowerCase(Locale.ROOT);

        return switch (intent) {
            case WATER -> containsAny(blob, List.of("water","sea","beach","diving","scuba","snorkeling","snorkelling","kayak","kayaking","underwater","marine","boat"));
            case HIKING -> containsAny(blob, List.of("hike","hiking","trek","trekking","trail","mountain","walk","randonnee","randonnée"));
            case CYCLING -> containsAny(blob, List.of("bike","biking","cycling","bicycle","velo","vélo","mtb"));
            case CAMPING -> containsAny(blob, List.of("camp","camping","tent","bivouac"));
            case CLIMBING -> containsAny(blob, List.of("climb","climbing","escalade","rock"));
            case HORSE_RIDING -> containsAny(blob, List.of("horse","horse riding","equitation","équitation","riding"));
            case DESERT -> containsAny(blob, List.of("desert","sahara","dune","camel","quad"));
            case NONE -> true;
        };
    }

    private boolean containsAny(String text, List<String> words) {
        for (String word : words) {
            if (text.contains(word.toLowerCase(Locale.ROOT))) {
                return true;
            }
        }
        return false;
    }

    private String safe(String s) {
        return s == null ? "" : s.toLowerCase(Locale.ROOT);
    }

    private List<String> safeList(List<String> items) {
        return items == null ? List.of() : items;
    }
}
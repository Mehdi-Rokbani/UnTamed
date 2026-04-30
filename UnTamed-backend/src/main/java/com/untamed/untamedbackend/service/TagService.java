package com.untamed.untamedbackend.service;

import com.untamed.untamedbackend.model.Tag;
import com.untamed.untamedbackend.model.TagStatus;
import com.untamed.untamedbackend.model.TagType;
import com.untamed.untamedbackend.repository.TagRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.text.Normalizer;
import java.util.*;

@Service
@RequiredArgsConstructor
public class TagService {

    private final TagRepository tagRepository;

    private static final Set<String> BLOCKED_TAGS = Set.of(
            "fun", "nice", "cool", "outdoor", "outdoors", "friends",
            "good", "best", "amazing", "beautiful", "activity", "trip",
            "experience", "tour", "challenge"
    );

    public List<String> processAiTags(List<String> rawTags) {
        if (rawTags == null || rawTags.isEmpty()) return List.of();

        Set<String> finalTags = new LinkedHashSet<>();

        for (String raw : rawTags) {
            String slug = normalizeSlug(raw);

            if (!isUsefulTag(slug)) continue;

            Tag tag = tagRepository.findBySlug(slug)
                    .map(existing -> {
                        existing.setUsageCount(existing.getUsageCount() + 1);
                        existing.setActive(true);
                        return existing;
                    })
                    .orElseGet(() -> Tag.builder()
                            .slug(slug)
                            .name(toDisplayName(slug))
                            .type(guessType(slug))
                            .status(TagStatus.AI_SUGGESTED)
                            .aiSuggested(true)
                            .active(true)
                            .usageCount(1)
                            .build());

            tagRepository.save(tag);
            finalTags.add(tag.getSlug());
        }

        return new ArrayList<>(finalTags);
    }

    public List<String> validateUsableTags(List<String> rawTags) {
        if (rawTags == null || rawTags.isEmpty()) return List.of();

        Set<String> usableTags = new LinkedHashSet<>();

        for (String raw : rawTags) {
            String slug = normalizeSlug(raw);
            if (!isUsefulTag(slug)) continue;

            tagRepository.findBySlug(slug)
                    .filter(Tag::isActive)
                    .filter(tag -> tag.getStatus() != TagStatus.REJECTED)
                    .ifPresent(tag -> usableTags.add(tag.getSlug()));
        }

        return new ArrayList<>(usableTags);
    }

    private boolean isUsefulTag(String slug) {
        if (slug == null || slug.isBlank()) return false;
        if (slug.length() < 3 || slug.length() > 40) return false;
        if (BLOCKED_TAGS.contains(slug)) return false;
        if (slug.matches("\\d+")) return false;
        return true;
    }

    private TagType guessType(String slug) {
        if (Set.of("hiking", "camping", "diving", "quad-biking", "running", "marathon", "kayaking", "cycling", "caving").contains(slug)) {
            return TagType.ACTIVITY;
        }

        if (Set.of("forest", "mountain", "beach", "desert", "waterfall", "sea", "cave", "lake", "river").contains(slug)) {
            return TagType.ENVIRONMENT;
        }

        if (Set.of("beginner-friendly", "physically-demanding", "short-trip", "long-distance", "endurance").contains(slug)) {
            return TagType.EFFORT;
        }

        if (Set.of("budget-friendly", "premium").contains(slug)) {
            return TagType.BUDGET;
        }

        return TagType.VIBE;
    }

    private String normalizeSlug(String input) {
        if (input == null) return "";

        String normalized = Normalizer.normalize(input, Normalizer.Form.NFD)
                .replaceAll("\\p{M}", "");

        return normalized
                .toLowerCase()
                .trim()
                .replace("&", "and")
                .replaceAll("[^a-z0-9\\s-]", "")
                .replaceAll("\\s+", "-")
                .replaceAll("-+", "-")
                .replaceAll("^-|-$", "");
    }

    private String toDisplayName(String slug) {
        String[] parts = slug.split("-");
        StringBuilder result = new StringBuilder();

        for (String part : parts) {
            if (part.isBlank()) continue;
            result.append(Character.toUpperCase(part.charAt(0)))
                    .append(part.substring(1))
                    .append(" ");
        }

        return result.toString().trim();
    }
}
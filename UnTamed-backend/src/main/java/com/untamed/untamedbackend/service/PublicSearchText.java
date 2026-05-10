package com.untamed.untamedbackend.service;

import java.text.Normalizer;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;

final class PublicSearchText {

    private PublicSearchText() {
    }

    static String normalize(String value) {
        String withoutAccents = Normalizer.normalize(value == null ? "" : value, Normalizer.Form.NFD)
                .replaceAll("\\p{M}", "");

        return withoutAccents
                .toLowerCase(Locale.ROOT)
                .replaceAll("[^\\p{Alnum}]+", " ")
                .trim()
                .replaceAll("\\s+", " ");
    }

    static List<String> variants(String rawQuery) {
        String normalized = normalize(rawQuery);

        if (normalized.isBlank()) {
            return List.of();
        }

        Set<String> variants = new LinkedHashSet<>();
        addVariant(variants, normalized);

        return new ArrayList<>(variants);
    }

    static boolean containsAnyVariant(String searchableText, List<String> variants) {
        String normalizedSearchableText = normalize(searchableText);

        return variants.stream().anyMatch(normalizedSearchableText::contains);
    }

    private static void addVariant(Set<String> variants, String value) {
        if (value == null || value.isBlank()) {
            return;
        }

        variants.add(value);

        if (value.contains("drahem")) {
            variants.add(value.replace("drahem", "draham"));
        }
        if (value.contains("draham")) {
            variants.add(value.replace("draham", "drahem"));
        }
        if (value.contains("djebel")) {
            variants.add(value.replace("djebel", "jebel"));
        }
        if (value.contains("jebel")) {
            variants.add(value.replace("jebel", "djebel"));
        }
    }
}

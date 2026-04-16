package com.untamed.untamedbackend.smartsearch.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AiSearchPlan {

    /**
     * Cleaned version of the original user query.
     * Example: "camel ride" -> "camel ride"
     */
    private String normalizedQuery;

    /**
     * High-level inferred intent.
     * Allowed values for now:
     * GENERIC, WATER, NATURE, RUNNING, DESERT
     */
    private String intent;

    /**
     * How strict the search should be.
     * Allowed values for now:
     * LOW, MEDIUM, HIGH
     */
    private String strictness;

    /**
     * AI-expanded concepts related to the search.
     * Example for "camel":
     * ["camel", "desert", "sahara", "dunes", "oasis"]
     */
    private List<String> concepts;

    /**
     * Terms that should be strongly present in the candidate when possible.
     * This is not necessarily a hard filter in all cases.
     */
    private List<String> mustIncludeAny;

    /**
     * Optional preferred tags inferred from the query.
     */
    private List<String> preferredTags;

    /**
     * Optional preferred difficulty inferred from the query.
     * Can be null.
     */
    private String preferredDifficulty;
}
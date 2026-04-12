package com.untamed.untamedbackend.smartsearch;

import org.springframework.stereotype.Component;

import java.util.List;

@Component
public class SearchIntentRules {

    public List<String> requiredTerms(SearchIntent intent) {
        return switch (intent) {
            case WATER -> List.of(
                    "water", "sea", "beach", "diving", "scuba", "snorkeling",
                    "snorkelling", "kayak", "kayaking", "underwater", "marine", "boat"
            );
            case HIKING -> List.of(
                    "hike", "hiking", "trek", "trekking", "trail", "mountain", "walk", "randonnee", "randonnée"
            );
            case CYCLING -> List.of(
                    "bike", "biking", "cycling", "bicycle", "velo", "vélo", "mtb"
            );
            case CAMPING -> List.of(
                    "camp", "camping", "tent", "bivouac"
            );
            case CLIMBING -> List.of(
                    "climb", "climbing", "escalade", "rock"
            );
            case HORSE_RIDING -> List.of(
                    "horse", "horse riding", "equitation", "équitation", "riding"
            );
            case DESERT -> List.of(
                    "desert", "sahara", "dune", "camel", "quad"
            );
            case NONE -> List.of();
        };
    }
}
package com.untamed.untamedbackend.service;

import com.untamed.untamedbackend.dto.AddressSuggestionDto;
import com.untamed.untamedbackend.model.ActivityStatus;
import com.untamed.untamedbackend.model.ActivityTemplate;
import com.untamed.untamedbackend.model.Address;
import com.untamed.untamedbackend.repository.ActivitySessionRepository;
import com.untamed.untamedbackend.repository.ActivityTemplateRepository;
import com.untamed.untamedbackend.repository.AddressRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

@Service
@RequiredArgsConstructor
@Slf4j
public class AddressPublicService {

    private static final int SUGGESTION_LIMIT = 10;

    private final AddressRepository addressRepo;
    private final ActivityTemplateRepository templateRepo;
    private final ActivitySessionRepository sessionRepo;

    public List<AddressSuggestionDto> suggest(String q) {
        String normalizedQuery = PublicSearchText.normalize(q);
        List<String> variants = PublicSearchText.variants(q);
        Map<String, PlaceAggregate> places = new LinkedHashMap<>();
        Instant now = Instant.now();

        templateRepo.findAll()
                .stream()
                .filter(template -> !template.isArchived())
                .filter(template -> hasUpcomingSession(template, now))
                .forEach(template -> addTemplatePlaces(template, places));

        List<AddressSuggestionDto> suggestions = places.values()
                .stream()
                .filter(place -> variants.isEmpty() || PublicSearchText.containsAnyVariant(place.displayName(), variants))
                .sorted(
                        Comparator
                                .comparingInt((PlaceAggregate place) -> matchRank(place.displayName(), variants))
                                .thenComparing(Comparator.comparingLong(PlaceAggregate::usesCount).reversed())
                                .thenComparingInt(place -> PublicSearchText.normalize(place.displayName()).length())
                                .thenComparing(PlaceAggregate::displayName)
                )
                .limit(SUGGESTION_LIMIT)
                .map(PlaceAggregate::toDto)
                .toList();

        log.info(
                "Public address suggestions q='{}', normalized='{}', returned={}",
                q,
                normalizedQuery,
                suggestions.stream().map(AddressSuggestionDto::displayName).toList()
        );

        return suggestions;
    }

    private void addTemplatePlaces(ActivityTemplate template, Map<String, PlaceAggregate> places) {
        if (template.getAddressId() == null || template.getAddressId().isBlank()) {
            return;
        }

        addressRepo.findById(template.getAddressId()).ifPresent(address -> {
            Set<String> templatePlaceKeys = new LinkedHashSet<>();

            addPlace(places, templatePlaceKeys, address.getLocality(), address, "locality");
            addPlace(places, templatePlaceKeys, address.getDelegation(), address, "delegation");
            addPlace(places, templatePlaceKeys, address.getGovernorate(), address, "governorate");

            for (String displayNamePlace : extractSimpleDisplayNamePlaces(address.getDisplayName())) {
                addPlace(places, templatePlaceKeys, displayNamePlace, address, "display");
            }
        });
    }

    private void addPlace(
            Map<String, PlaceAggregate> places,
            Set<String> templatePlaceKeys,
            String rawName,
            Address address,
            String source
    ) {
        String displayName = cleanPlaceName(rawName);

        if (displayName == null) {
            return;
        }

        String key = PublicSearchText.normalize(displayName);

        if (key.isBlank() || !templatePlaceKeys.add(key)) {
            return;
        }

        PlaceAggregate aggregate = places.get(key);

        if (aggregate == null) {
            places.put(key, PlaceAggregate.from(displayName, address, source));
        } else {
            places.put(key, aggregate.add(address, source));
        }
    }

    private List<String> extractSimpleDisplayNamePlaces(String displayName) {
        if (displayName == null || displayName.isBlank()) {
            return List.of();
        }

        List<String> places = new ArrayList<>();

        for (String part : displayName.split(",")) {
            String cleaned = cleanPlaceName(part);

            if (cleaned == null) {
                continue;
            }

            if (isSpecificAddressLabel(cleaned)) {
                continue;
            }

            places.add(cleaned);
        }

        return places;
    }

    private String cleanPlaceName(String rawName) {
        if (rawName == null) {
            return null;
        }

        String name = rawName.trim();

        if (name.isBlank()) {
            return null;
        }

        if (!name.matches(".*[A-Za-z].*")) {
            return null;
        }

        if (name.matches("^\\d+$") || name.equalsIgnoreCase("Tunisia")) {
            return null;
        }

        return name;
    }

    private boolean isSpecificAddressLabel(String label) {
        return label.matches("(?i).*\\b(rue|street|avenue|airport|university|campus|faculty|hotel|resort|ribat|museum|stadium|complex|school|hospital|station|land)\\b.*");
    }

    private boolean hasUpcomingSession(ActivityTemplate template, Instant now) {
        return sessionRepo
                .findFirstByTemplateIdAndStatusAndStartAtAfterOrderByStartAtAsc(
                        template.getId(),
                        ActivityStatus.PUBLISHED,
                        now
                )
                .isPresent();
    }

    private int matchRank(String displayName, List<String> variants) {
        if (variants.isEmpty()) {
            return 0;
        }

        String normalizedDisplayName = PublicSearchText.normalize(displayName);

        for (String variant : variants) {
            if (normalizedDisplayName.equals(variant)) {
                return 0;
            }
        }

        for (String variant : variants) {
            if (normalizedDisplayName.startsWith(variant)) {
                return 1;
            }
        }

        for (String variant : variants) {
            if (normalizedDisplayName.contains(variant)) {
                return 2;
            }
        }

        return 3;
    }

    private record PlaceAggregate(
            String displayName,
            String governorate,
            String delegation,
            String locality,
            double latitudeSum,
            double longitudeSum,
            long coordinateCount,
            long usesCount,
            String bestSource
    ) {
        static PlaceAggregate from(String displayName, Address address, String source) {
            boolean hasCoordinates = address.getLatitude() != null && address.getLongitude() != null;

            return new PlaceAggregate(
                    displayName,
                    address.getGovernorate(),
                    source.equals("delegation") || source.equals("locality") ? address.getDelegation() : null,
                    source.equals("locality") || source.equals("display") ? displayName : null,
                    hasCoordinates ? address.getLatitude() : 0,
                    hasCoordinates ? address.getLongitude() : 0,
                    hasCoordinates ? 1 : 0,
                    1,
                    source
            );
        }

        PlaceAggregate add(Address address, String source) {
            boolean hasCoordinates = address.getLatitude() != null && address.getLongitude() != null;

            return new PlaceAggregate(
                    displayName,
                    governorate != null ? governorate : address.getGovernorate(),
                    delegation != null ? delegation : address.getDelegation(),
                    locality,
                    latitudeSum + (hasCoordinates ? address.getLatitude() : 0),
                    longitudeSum + (hasCoordinates ? address.getLongitude() : 0),
                    coordinateCount + (hasCoordinates ? 1 : 0),
                    usesCount + 1,
                    bestSource
            );
        }

        AddressSuggestionDto toDto() {
            Double latitude = coordinateCount == 0 ? null : latitudeSum / coordinateCount;
            Double longitude = coordinateCount == 0 ? null : longitudeSum / coordinateCount;

            return new AddressSuggestionDto(
                    "place:" + PublicSearchText.normalize(displayName).replace(" ", "-"),
                    displayName,
                    governorate,
                    delegation,
                    locality,
                    latitude,
                    longitude,
                    usesCount
            );
        }
    }
}

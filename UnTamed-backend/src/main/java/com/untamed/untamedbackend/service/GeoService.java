// src/main/java/com/untamed/untamedbackend/service/GeoService.java
package com.untamed.untamedbackend.service;

import com.untamed.untamedbackend.dto.AddressPickDto;
import com.untamed.untamedbackend.dto.AddressResponse;
import com.untamed.untamedbackend.dto.LocationIqAutocompleteItem;
import com.untamed.untamedbackend.integrations.locationiq.LocationIqClient;
import com.untamed.untamedbackend.dto.LocationIqReverseResponse;
import com.untamed.untamedbackend.model.Address;
import com.untamed.untamedbackend.repository.AddressRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.Map;

@Service
public class GeoService {

    private static final String PROVIDER = "locationiq";

    private final LocationIqClient locationIq;
    private final AddressRepository addressRepo;

    public GeoService(LocationIqClient locationIq, AddressRepository addressRepo) {
        this.locationIq = locationIq;
        this.addressRepo = addressRepo;
    }

    @Transactional
    public List<AddressResponse> autocomplete(String q, int limit) {
        // Tip: Tunisia only. LocationIQ uses ISO3166-1 alpha2; Tunisia = "tn"
        String countrycodes = "tn";

        List<LocationIqAutocompleteItem> items = locationIq
                .autocomplete(q, limit, countrycodes)
                .block();

        if (items == null) return List.of();

        return items.stream()
                .map(this::upsertFromAutocomplete)
                .map(this::toResponse)
                .toList();
    }

    @Transactional
    public AddressResponse reverse(double lat, double lon, int zoom) {
        var r = locationIq.reverse(lat, lon, zoom).block();
        if (r == null || r.placeId == null || r.placeId.isBlank()) {
            throw new IllegalArgumentException("Reverse geocoding returned empty result");
        }

        Address a = addressRepo
                .findByProviderAndProviderPlaceId(PROVIDER, r.placeId)
                .orElseGet(Address::new);

        a.setProvider(PROVIDER);
        a.setProviderPlaceId(r.placeId);
        a.setDisplayName(r.displayName);
        a.setLatitude(parseDoubleOrNull(r.lat));
        a.setLongitude(parseDoubleOrNull(r.lon));

        // extract structured fields if present
        if (r.address != null) {
            a.setGovernorate(stringOrNull(r.address.get("state")));
            a.setDelegation(stringOrNull(r.address.get("county")));
            a.setLocality(firstNonBlank(
                    stringOrNull(r.address.get("city")),
                    stringOrNull(r.address.get("town")),
                    stringOrNull(r.address.get("village")),
                    stringOrNull(r.address.get("suburb"))
            ));
        }

        bumpUses(a);          // optional: only if reverse is user-triggered
        // touch createdAt/updatedAt if you have them

        Address saved = addressRepo.save(a);
        return toResponse(saved);

    }

    public byte[] staticMap(double lat, double lon, String label, String variant) {
        validateCoordinate(lat, -90, 90, "lat");
        validateCoordinate(lon, -180, 180, "lon");

        // Keep accepting label for the public API, but do not forward arbitrary user text
        // into the provider URL unless the provider supports safe labeling later.
        sanitizeLabel(label);

        byte[] image = locationIq.staticMap(lat, lon).block();
        if (image == null || image.length == 0) {
            throw new IllegalArgumentException("Static map unavailable");
        }
        return image;
    }

    private void validateCoordinate(double value, double min, double max, String name) {
        if (!Double.isFinite(value) || value < min || value > max) {
            throw new IllegalArgumentException("Invalid " + name);
        }
    }

    private String sanitizeLabel(String label) {
        if (label == null) return null;
        String trimmed = label.trim();
        if (trimmed.isBlank()) return null;
        return trimmed.length() > 80 ? trimmed.substring(0, 80) : trimmed;
    }

        private Address upsertFromAutocomplete(LocationIqAutocompleteItem it) {
        String placeId = it.placeId;
        Address a = addressRepo.findByProviderAndProviderPlaceId(PROVIDER, placeId)
                .orElseGet(Address::new);

        a.setProvider(PROVIDER);
        a.setProviderPlaceId(placeId);
        a.setDisplayName(it.displayName);

        // LocationIQ sends strings
        a.setLatitude(parseDoubleOrNull(it.lat));
        a.setLongitude(parseDoubleOrNull(it.lon));

        // Light heuristic: mark as recently used
        bumpUses(a);

        // timestamps if your entity supports
        touch(a);

        return addressRepo.save(a);
    }

    private Address upsertFromReverse(LocationIqReverseResponse r) {
        Address a = addressRepo.findByProviderAndProviderPlaceId(PROVIDER, r.placeId)
                .orElseGet(Address::new);

        a.setProvider(PROVIDER);
        a.setProviderPlaceId(r.placeId);
        a.setDisplayName(r.displayName);

        a.setLatitude(parseDoubleOrNull(r.lat));
        a.setLongitude(parseDoubleOrNull(r.lon));

        // Extract Tunisia-ish fields if present
        Map<String, Object> addr = r.address;
        if (addr != null) {
            // LocationIQ keys vary; keep defensive
            a.setGovernorate(stringOrNull(addr.get("state")));
            a.setDelegation(stringOrNull(addr.get("county")));     // sometimes
            a.setLocality(
                    firstNonBlank(
                            stringOrNull(addr.get("city")),
                            stringOrNull(addr.get("town")),
                            stringOrNull(addr.get("village")),
                            stringOrNull(addr.get("suburb"))
                    )
            );
        }

        bumpUses(a);
        touch(a);

        return addressRepo.save(a);
    }

    private void bumpUses(Address a) {
        Long uses = a.getUsesCount();
        a.setUsesCount(uses == null ? 1L : uses + 1L);
    }

    private void touch(Address a) {
        // Only if you have these fields; otherwise remove these lines.
        if (a.getCreatedAt() == null) a.setCreatedAt(Instant.now());
        a.setUpdatedAt(Instant.now());
    }

    private Double parseDoubleOrNull(String v) {
        if (v == null || v.isBlank()) return null;
        try { return Double.parseDouble(v); } catch (Exception e) { return null; }
    }

    private String stringOrNull(Object o) {
        return (o == null) ? null : String.valueOf(o);
    }

    private String firstNonBlank(String... vals) {
        if (vals == null) return null;
        for (String v : vals) {
            if (v != null && !v.isBlank()) return v;
        }
        return null;
    }

    private AddressResponse toResponse(Address a) {
        return new AddressResponse(
                a.getId(),
                a.getProvider(),
                a.getProviderPlaceId(),
                a.getDisplayName(),
                a.getGovernorate(),
                a.getDelegation(),
                a.getLocality(),
                a.getLatitude(),
                a.getLongitude(),
                a.getUsesCount(),
                a.getCreatedAt(),
                a.getUpdatedAt()
        );
    }



    @Transactional
    public Address resolveUpsertAndBumpUses(AddressPickDto pick) {

        // 1) If we already have providerPlaceId, use it (no reverse needed)
        if (pick.providerPlaceId() != null && !pick.providerPlaceId().isBlank()) {
            String provider = (pick.provider() == null || pick.provider().isBlank()) ? PROVIDER : pick.provider();

            Address a = addressRepo.findByProviderAndProviderPlaceId(provider, pick.providerPlaceId())
                    .orElseGet(Address::new);

            a.setProvider(provider);
            a.setProviderPlaceId(pick.providerPlaceId());
            if (pick.displayName() != null) a.setDisplayName(pick.displayName());
            if (pick.latitude() != null) a.setLatitude(pick.latitude());
            if (pick.longitude() != null) a.setLongitude(pick.longitude());

            bumpUses(a);
            return addressRepo.save(a);
        }

        // 2) Otherwise reverse by lat/lon to get place_id
        if (pick.latitude() == null || pick.longitude() == null) {
            throw new IllegalArgumentException("Address must include providerPlaceId or (latitude, longitude)");
        }

        // ✅ DECLARE r HERE
        LocationIqReverseResponse r = locationIq.reverse(pick.latitude(), pick.longitude(), 18).block();
        if (r == null || r.placeId == null || r.placeId.isBlank()) {
            throw new IllegalArgumentException("Reverse geocoding returned empty result");
        }

        Address a = addressRepo.findByProviderAndProviderPlaceId(PROVIDER, r.placeId)
                .orElseGet(Address::new);

        a.setProvider(PROVIDER);
        a.setProviderPlaceId(r.placeId);
        a.setDisplayName(r.displayName);
        a.setLatitude(parseDoubleOrNull(r.lat));
        a.setLongitude(parseDoubleOrNull(r.lon));

        if (r.address != null) {
            a.setGovernorate(stringOrNull(r.address.get("state")));
            a.setDelegation(stringOrNull(r.address.get("county")));
            a.setLocality(firstNonBlank(
                    stringOrNull(r.address.get("city")),
                    stringOrNull(r.address.get("town")),
                    stringOrNull(r.address.get("village")),
                    stringOrNull(r.address.get("suburb"))
            ));
        }

        bumpUses(a);
        return addressRepo.save(a);
    }


}

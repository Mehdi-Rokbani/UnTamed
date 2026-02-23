// src/main/java/com/untamed/untamedbackend/controller/GeoController.java
package com.untamed.untamedbackend.controller;

import com.untamed.untamedbackend.dto.AddressResponse;
import com.untamed.untamedbackend.repository.AddressRepository;
import com.untamed.untamedbackend.service.GeoService;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/geo")
public class GeoController {

    private final AddressRepository addressRepo;
    private final GeoService geoService;

    public GeoController(AddressRepository addressRepo, GeoService geoService) {
        this.addressRepo = addressRepo;
        this.geoService = geoService;
    }

    @GetMapping("/popular")
    public List<AddressResponse> popular() {
        return addressRepo.findTop20ByOrderByUsesCountDesc()
                .stream()
                .map(a -> new AddressResponse(
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
                ))
                .toList();
    }

    // REAL autocomplete using LocationIQ (+ cache)
    @GetMapping("/autocomplete")
    public List<AddressResponse> autocomplete(
            @RequestParam String q,
            @RequestParam(defaultValue = "10") int limit
    ) {
        return geoService.autocomplete(q, limit);
    }

    // Reverse geocoding using LocationIQ (+ cac    he)
    @GetMapping("/reverse")
    public AddressResponse reverse(
            @RequestParam double lat,
            @RequestParam double lon,
            @RequestParam(defaultValue = "18") int zoom
    ) {
        return geoService.reverse(lat, lon, zoom);
    }

    // Keep your old DB-only search if you still want it
    @GetMapping("/search")
    public List<AddressResponse> search(@RequestParam String q) {
        return addressRepo
                .findTop10ByDisplayNameContainingIgnoreCaseOrderByUsesCountDesc(q)
                .stream()
                .map(a -> new AddressResponse(
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
                ))
                .toList();
    }
}

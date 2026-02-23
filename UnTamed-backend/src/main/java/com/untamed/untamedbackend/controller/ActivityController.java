// src/main/java/com/untamed/untamedbackend/controller/ActivityController.java
package com.untamed.untamedbackend.controller;

import com.untamed.untamedbackend.dto.ActivityCreateRequest;
import com.untamed.untamedbackend.dto.ActivityResponse;
import com.untamed.untamedbackend.dto.ActivityUpdateRequest;
import com.untamed.untamedbackend.model.ActivityStatus;
import com.untamed.untamedbackend.service.ActivityService;
import jakarta.validation.Valid;
import org.springframework.http.MediaType;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

@RestController
@RequestMapping("/api/activities")
public class ActivityController {

    private final ActivityService activityService;

    public ActivityController(ActivityService activityService) {
        this.activityService = activityService;
    }

    // -------- Public --------

    @GetMapping
    public List<ActivityResponse> listPublished() {
        return activityService.listPublished();
    }

    @GetMapping("/{id}")
    public ActivityResponse getById(@PathVariable String id) {
        // allow private draft view only if authenticated and owner (service handles this)
        return activityService.getById(id, getAuthEmailOrNull());
    }

    // -------- Guide (authenticated) --------

    @GetMapping("/mine")
    public List<ActivityResponse> listMine() {
        return activityService.listMine(requireAuthEmail());
    }

    @PostMapping
    public ActivityResponse create(@Valid @RequestBody ActivityCreateRequest req) {
        return activityService.create(req, requireAuthEmail());
    }

    @PatchMapping("/{id}")
    public ActivityResponse update(@PathVariable String id, @Valid @RequestBody ActivityUpdateRequest req) {
        return activityService.update(id, req, requireAuthEmail());
    }

    // Backward compatible (old frontend toggles published)
    @PatchMapping("/{id}/published")
    public ActivityResponse setPublished(@PathVariable String id, @RequestParam boolean published) {
        return activityService.setPublished(id, published, requireAuthEmail());
    }

    // Preferred endpoint (new)
    @PatchMapping("/{id}/status")
    public ActivityResponse setStatus(@PathVariable String id, @RequestParam ActivityStatus status) {
        return activityService.setStatus(id, status, requireAuthEmail());
    }

    // -------- Images (GUIDE / owner enforced in service) --------

    @PostMapping(value = "/{id}/images", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ActivityResponse addImage(
            @PathVariable String id,
            @RequestPart("file") MultipartFile file,
            @RequestParam(name = "cover", defaultValue = "false") boolean cover,
            @RequestParam(name = "alt", required = false) String alt
    ) {
        return activityService.addImage(id, file, cover, alt, requireAuthEmail());
    }

    @DeleteMapping("/{id}/images")
    public ActivityResponse deleteImageByQuery(
            @PathVariable String id,
            @RequestParam String publicId
    ) {
        return activityService.deleteImage(id, publicId, requireAuthEmail());
    }

    @PatchMapping("/{id}/images/cover")
    public ActivityResponse setCoverByQuery(
            @PathVariable String id,
            @RequestParam String publicId
    ) {
        return activityService.setCoverImage(id, publicId, requireAuthEmail());
    }



    // Optional: reorder gallery by passing the list of publicIds in desired order
    @PatchMapping("/{id}/images/reorder")
    public ActivityResponse reorderImages(
            @PathVariable String id,
            @RequestBody List<String> publicIdsInOrder
    ) {
        return activityService.reorderImages(id, publicIdsInOrder, requireAuthEmail());
    }

    // -------- Admin / Debug (optional) --------
    // If you don’t want it public, protect it in SecurityConfig (e.g., ADMIN only)
    @GetMapping("/all")
    public List<ActivityResponse> listAll() {
        return activityService.listAll();
    }

    // -------- Auth helpers --------

    private String requireAuthEmail() {
        String email = getAuthEmailOrNull();
        if (email == null) throw new IllegalArgumentException("Unauthorized");
        return email;
    }

    private String getAuthEmailOrNull() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated()) return null;

        Object principal = auth.getPrincipal();

        // Common cases:
        // - principal is email String
        // - principal is UserDetails (username = email)
        if (principal instanceof String s) {
            if ("anonymousUser".equalsIgnoreCase(s)) return null;
            return s;
        }

        return auth.getName(); // fallback (often email/username)
    }
}

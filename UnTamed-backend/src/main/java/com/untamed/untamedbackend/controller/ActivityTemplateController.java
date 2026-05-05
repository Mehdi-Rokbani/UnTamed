package com.untamed.untamedbackend.controller;

import com.untamed.untamedbackend.dto.*;
import com.untamed.untamedbackend.service.ActivityTemplateService;
import jakarta.validation.Valid;
import org.springframework.http.MediaType;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

@RestController
@RequestMapping("/api/templates")
public class ActivityTemplateController {

    private final ActivityTemplateService templateService;

    public ActivityTemplateController(ActivityTemplateService templateService) {
        this.templateService = templateService;
    }

    // -------- Guide templates --------

    @GetMapping("/mine")
    public Object listMine(
            @RequestParam(required = false) Integer page,
            @RequestParam(required = false) Integer size
    ) {
        if (page == null && size == null) {
            return templateService.listMineTemplates(requireAuthEmail());
        }

        return templateService.listMineTemplatesPage(requireAuthEmail(), resolvePage(page), resolveSize(size, 20));
    }

    @GetMapping("/{id}")
    public ActivityTemplateResponse getById(@PathVariable String id) {
        return templateService.getTemplate(id, requireAuthEmail());
    }

    @PostMapping
    public ActivityTemplateResponse create(
            @Valid @RequestBody ActivityTemplateCreateRequest req
    ) {
        return templateService.createTemplate(req, requireAuthEmail());
    }

    @PatchMapping("/{id}")
    public ActivityTemplateResponse update(
            @PathVariable String id,
            @Valid @RequestBody ActivityTemplateUpdateRequest req
    ) {
        return templateService.updateTemplate(id, req, requireAuthEmail());
    }


    // -------- Template images --------

    @PostMapping(value = "/{id}/images", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ActivityTemplateResponse addImage(
            @PathVariable String id,
            @RequestPart("file") MultipartFile file,
            @RequestParam(name = "cover", defaultValue = "false") boolean cover,
            @RequestParam(name = "alt", required = false) String alt
    ) {
        return templateService.addImage(id, file, cover, alt, requireAuthEmail());
    }

    @DeleteMapping("/{id}/images")
    public ActivityTemplateResponse deleteImage(
            @PathVariable String id,
            @RequestParam String publicId
    ) {
        return templateService.deleteImage(id, publicId, requireAuthEmail());
    }

    @PatchMapping("/{id}/images/cover")
    public ActivityTemplateResponse setCover(
            @PathVariable String id,
            @RequestParam String publicId
    ) {
        return templateService.setCoverImage(id, publicId, requireAuthEmail());
    }

    @PatchMapping("/{id}/images/reorder")
    public ActivityTemplateResponse reorderImages(
            @PathVariable String id,
            @RequestBody List<String> publicIdsInOrder
    ) {
        return templateService.reorderImages(id, publicIdsInOrder, requireAuthEmail());
    }

    // -------- Auth helpers --------

    private String requireAuthEmail() {
        String email = getAuthEmailOrNull();

        if (email == null) {
            throw new AccessDeniedException("Unauthorized");
        }

        return email;
    }

    private String getAuthEmailOrNull() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();

        if (auth == null || !auth.isAuthenticated()) {
            return null;
        }

        Object principal = auth.getPrincipal();

        if (principal instanceof String s) {
            if ("anonymousUser".equalsIgnoreCase(s)) {
                return null;
            }

            return s;
        }

        return auth.getName();
    }

    private int resolvePage(Integer page) {
        return page == null ? 0 : Math.max(0, page);
    }

    private int resolveSize(Integer size, int defaultSize) {
        return size == null ? defaultSize : Math.max(1, Math.min(size, 50));
    }

    @DeleteMapping("/{id}")
    public ActivityTemplateDeleteResponse delete(@PathVariable String id) {
        return templateService.deleteTemplate(id, requireAuthEmail());
    }

    @PatchMapping("/{id}/archive")
    public ActivityTemplateArchiveResponse archive(@PathVariable String id) {
        return templateService.archiveTemplate(id, requireAuthEmail());
    }
}

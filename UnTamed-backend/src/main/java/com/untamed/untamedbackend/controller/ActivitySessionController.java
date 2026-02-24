package com.untamed.untamedbackend.controller;

import com.untamed.untamedbackend.dto.*;
import com.untamed.untamedbackend.model.ActivityStatus;
import com.untamed.untamedbackend.service.ActivitySessionService;
import jakarta.validation.Valid;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/sessions")
public class ActivitySessionController {

    private final ActivitySessionService sessionService;

    public ActivitySessionController(ActivitySessionService sessionService) {
        this.sessionService = sessionService;
    }

    // -------- Public --------

    // Public browse = published sessions (each includes template rating/info)
    @GetMapping
    public List<ActivitySessionResponse> listPublished() {
        return sessionService.listPublished();
    }

    @GetMapping("/{id}")
    public ActivitySessionResponse getById(@PathVariable String id) {
        // allow private draft view only if authenticated and owner (service handles this)
        return sessionService.getSessionById(id, getAuthEmailOrNull());
    }

    // -------- Guide (authenticated) --------

    @GetMapping("/mine")
    public List<ActivitySessionResponse> listMine() {
        return sessionService.listMine(requireAuthEmail());
    }

    // create a session under a template
    @PostMapping("/template/{templateId}")
    public ActivitySessionResponse create(
            @PathVariable String templateId,
            @Valid @RequestBody ActivitySessionCreateRequest req
    ) {
        return sessionService.createSession(templateId, req, requireAuthEmail());
    }

    @PatchMapping("/{id}")
    public ActivitySessionResponse update(@PathVariable String id, @Valid @RequestBody ActivitySessionUpdateRequest req) {
        return sessionService.updateSession(id, req, requireAuthEmail());
    }

    // Backward compatible toggle (optional)
    @PatchMapping("/{id}/published")
    public ActivitySessionResponse setPublished(@PathVariable String id, @RequestParam boolean published) {
        return sessionService.setStatus(id, published ? ActivityStatus.PUBLISHED : ActivityStatus.DRAFT, requireAuthEmail());
    }

    @PatchMapping("/{id}/status")
    public ActivitySessionResponse setStatus(@PathVariable String id, @RequestParam ActivityStatus status) {
        return sessionService.setStatus(id, status, requireAuthEmail());
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
        if (principal instanceof String s) {
            if ("anonymousUser".equalsIgnoreCase(s)) return null;
            return s;
        }
        return auth.getName();
    }
}
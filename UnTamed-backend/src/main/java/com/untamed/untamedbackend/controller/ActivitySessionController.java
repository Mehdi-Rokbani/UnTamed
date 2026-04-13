package com.untamed.untamedbackend.controller;

import com.untamed.untamedbackend.booking.BookingService;
import com.untamed.untamedbackend.booking.ParticipantsPreviewResponse;
import com.untamed.untamedbackend.dto.ActivitySessionCreateRequest;
import com.untamed.untamedbackend.dto.ActivitySessionResponse;
import com.untamed.untamedbackend.dto.ActivitySessionUpdateRequest;
import com.untamed.untamedbackend.model.ActivityStatus;
import com.untamed.untamedbackend.service.ActivitySessionService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/sessions")
@RequiredArgsConstructor
public class ActivitySessionController {

    private final ActivitySessionService sessionService;
    private final BookingService bookingService;

    // -------- Public --------

    @GetMapping
    public List<ActivitySessionResponse> listPublished() {
        return sessionService.listPublished();
    }

    @GetMapping("/{id}")
    public ActivitySessionResponse getById(@PathVariable String id) {
        return sessionService.getSessionById(id, getAuthEmailOrNull());
    }

    @GetMapping("/{sessionId}/participants-preview")
    public ResponseEntity<ParticipantsPreviewResponse> getParticipantsPreview(
            @PathVariable String sessionId
    ) {
        return ResponseEntity.ok(bookingService.getParticipantsPreview(sessionId));
    }

    // -------- Guide (authenticated) --------

    @GetMapping("/mine")
    public List<ActivitySessionResponse> listMine() {
        return sessionService.listMine(requireAuthEmail());
    }

    @PostMapping("/template/{templateId}")
    public ActivitySessionResponse create(
            @PathVariable String templateId,
            @Valid @RequestBody ActivitySessionCreateRequest req
    ) {
        return sessionService.createSession(templateId, req, requireAuthEmail());
    }

    @PatchMapping("/{id}")
    public ActivitySessionResponse update(
            @PathVariable String id,
            @Valid @RequestBody ActivitySessionUpdateRequest req
    ) {
        return sessionService.updateSession(id, req, requireAuthEmail());
    }

    @PatchMapping("/{id}/published")
    public ActivitySessionResponse setPublished(
            @PathVariable String id,
            @RequestParam boolean published
    ) {
        return sessionService.setStatus(
                id,
                published ? ActivityStatus.PUBLISHED : ActivityStatus.DRAFT,
                requireAuthEmail()
        );
    }

    @PatchMapping("/{id}/status")
    public ActivitySessionResponse setStatus(
            @PathVariable String id,
            @RequestParam ActivityStatus status
    ) {
        return sessionService.setStatus(id, status, requireAuthEmail());
    }

    // -------- Auth helpers --------

    private String requireAuthEmail() {
        String email = getAuthEmailOrNull();
        if (email == null) {
            throw new IllegalArgumentException("Unauthorized");
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
}
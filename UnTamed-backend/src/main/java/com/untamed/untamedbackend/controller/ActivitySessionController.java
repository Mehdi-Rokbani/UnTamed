package com.untamed.untamedbackend.controller;

import com.untamed.untamedbackend.booking.BookingService;
import com.untamed.untamedbackend.booking.ParticipantsPreviewResponse;
import com.untamed.untamedbackend.dto.ActivitySessionCreateRequest;
import com.untamed.untamedbackend.dto.ActivitySessionDeleteResponse;
import com.untamed.untamedbackend.dto.ActivitySessionResponse;
import com.untamed.untamedbackend.dto.ActivitySessionUpdateRequest;
import com.untamed.untamedbackend.dto.GuideSessionDetailsResponse;
import com.untamed.untamedbackend.model.ActivityStatus;
import com.untamed.untamedbackend.service.ActivitySessionService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.AccessDeniedException;
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
    public ParticipantsPreviewResponse getParticipantsPreview(
            @PathVariable String sessionId
    ) {
        return bookingService.getParticipantsPreview(sessionId);
    }

    // -------- Guide dashboard --------

    @GetMapping("/mine")
    public Object listMine(
            @RequestParam(required = false) Integer page,
            @RequestParam(required = false) Integer size
    ) {
        if (page == null && size == null) {
            return sessionService.listMine(requireAuthEmail());
        }

        return sessionService.listMinePage(requireAuthEmail(), resolvePage(page), resolveSize(size, 20));
    }

    @GetMapping("/mine/past")
    public List<ActivitySessionResponse> listMinePast() {
        return sessionService.listMinePast(requireAuthEmail());
    }

    @GetMapping("/mine/upcoming")
    public List<ActivitySessionResponse> listMineUpcoming() {
        return sessionService.listMineUpcoming(requireAuthEmail());
    }

    @GetMapping("/{id}/guide-details")
    public GuideSessionDetailsResponse getGuideDetails(@PathVariable String id) {
        return sessionService.getGuideSessionDetails(id, requireAuthEmail());
    }

    // -------- Guide session writes --------

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

    @PostMapping("/{id}/cancel")
    public ActivitySessionDeleteResponse cancel(@PathVariable String id) {
        return sessionService.deleteOrCancelSession(id, requireAuthEmail());
    }

    @DeleteMapping("/{id}")
    public ActivitySessionDeleteResponse deleteOrCancel(@PathVariable String id) {
        return sessionService.deleteOrCancelSession(id, requireAuthEmail());
    }

    @PatchMapping("/{id}/restore")
    public ActivitySessionResponse restore(@PathVariable String id) {
        return sessionService.restoreCancelledSession(id, requireAuthEmail());
    }

    @DeleteMapping("/{id}/permanent")
    public ActivitySessionDeleteResponse deletePermanently(@PathVariable String id) {
        return sessionService.permanentlyDeleteCancelledSession(id, requireAuthEmail());
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
}

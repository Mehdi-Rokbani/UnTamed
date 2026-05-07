package com.untamed.untamedbackend.controller;

import com.untamed.untamedbackend.dto.CreateCertificateRequest;
import com.untamed.untamedbackend.dto.GuideTemplateSessionsDashboardResponse;
import com.untamed.untamedbackend.dto.GuideProfileResponse;
import com.untamed.untamedbackend.dto.UpdateCertificateRequest;
import com.untamed.untamedbackend.dto.UpdateGuideProfileRequest;
import com.untamed.untamedbackend.service.GuideTemplateSessionsDashboardService;
import com.untamed.untamedbackend.service.GuideService;
import jakarta.validation.Valid;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/guides")
public class GuideController {

    private final GuideService guides;
    private final GuideTemplateSessionsDashboardService templateSessionsDashboard;

    public GuideController(
            GuideService guides,
            GuideTemplateSessionsDashboardService templateSessionsDashboard
    ) {
        this.guides = guides;
        this.templateSessionsDashboard = templateSessionsDashboard;
    }

    @GetMapping("/me")
    public GuideProfileResponse getMe(Authentication auth) {
        return guides.getMe(auth.getName());
    }

    @GetMapping("/templates/{templateId}/sessions-dashboard")
    public GuideTemplateSessionsDashboardResponse getTemplateSessionsDashboard(
            @PathVariable String templateId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            Authentication auth
    ) {
        if (auth == null || auth.getName() == null) {
            throw new AccessDeniedException("Not authenticated");
        }

        return templateSessionsDashboard.getDashboard(
                auth.getName(),
                templateId,
                page,
                size
        );
    }

    @PatchMapping("/me")
    public GuideProfileResponse updateMe(@Valid @RequestBody UpdateGuideProfileRequest req, Authentication auth) {
        if (auth == null || auth.getName() == null) {
            throw new AccessDeniedException("Not authenticated");
        }
        return guides.updateMe(auth.getName(), req);
    }

    @PostMapping("/me/certificates")
    public GuideProfileResponse addCertificate(@Valid @RequestBody CreateCertificateRequest req,
                                               Authentication auth) {
        return guides.addCertificate(auth.getName(), req);
    }

    @PatchMapping("/me/certificates/{certificateId}")
    public GuideProfileResponse updateCertificate(@PathVariable String certificateId,
                                                  @Valid @RequestBody UpdateCertificateRequest req,
                                                  Authentication auth) {
        return guides.updateCertificate(auth.getName(), certificateId, req);
    }

    @DeleteMapping("/me/certificates/{certificateId}")
    public GuideProfileResponse deleteCertificate(@PathVariable String certificateId,
                                                  Authentication auth) {
        return guides.deleteCertificate(auth.getName(), certificateId);
    }
}

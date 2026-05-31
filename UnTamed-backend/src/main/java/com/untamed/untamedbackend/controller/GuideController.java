package com.untamed.untamedbackend.controller;

import com.untamed.untamedbackend.dto.CreateCertificateRequest;
import com.untamed.untamedbackend.dto.GuideTemplateSessionsDashboardResponse;
import com.untamed.untamedbackend.dto.GuideProfileResponse;
import com.untamed.untamedbackend.dto.UpdateCertificateRequest;
import com.untamed.untamedbackend.dto.UpdateGuideProfileRequest;
import com.untamed.untamedbackend.revenue.GuideEarningsSummaryResponse;
import com.untamed.untamedbackend.revenue.PayoutBatchResponse;
import com.untamed.untamedbackend.revenue.RevenueRecordResponse;
import com.untamed.untamedbackend.revenue.RevenueService;
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
    private final RevenueService revenueService;

    public GuideController(
            GuideService guides,
            GuideTemplateSessionsDashboardService templateSessionsDashboard,
            RevenueService revenueService
    ) {
        this.guides = guides;
        this.templateSessionsDashboard = templateSessionsDashboard;
        this.revenueService = revenueService;
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

    @GetMapping("/me/earnings/summary")
    public GuideEarningsSummaryResponse getEarningsSummary(Authentication auth) {
        String guideId = revenueService.requireGuideIdByEmail(requireAuthEmail(auth));
        return revenueService.getGuideEarningsSummary(guideId);
    }

    @GetMapping("/me/revenue-records")
    public java.util.List<RevenueRecordResponse> getRevenueRecords(Authentication auth) {
        String guideId = revenueService.requireGuideIdByEmail(requireAuthEmail(auth));
        return revenueService.getGuideRevenueRecords(guideId);
    }

    @GetMapping("/me/payouts")
    public java.util.List<PayoutBatchResponse> getPayouts(Authentication auth) {
        String guideId = revenueService.requireGuideIdByEmail(requireAuthEmail(auth));
        return revenueService.getGuidePayouts(guideId);
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

    private String requireAuthEmail(Authentication auth) {
        if (auth == null || auth.getName() == null) {
            throw new AccessDeniedException("Not authenticated");
        }

        return auth.getName();
    }
}

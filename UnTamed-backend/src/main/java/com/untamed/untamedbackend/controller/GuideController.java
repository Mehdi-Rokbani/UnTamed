package com.untamed.untamedbackend.controller;

import com.untamed.untamedbackend.dto.CreateCertificateRequest;
import com.untamed.untamedbackend.dto.GuideProfileResponse;
import com.untamed.untamedbackend.dto.UpdateCertificateRequest;
import com.untamed.untamedbackend.dto.UpdateGuideProfileRequest;
import com.untamed.untamedbackend.service.GuideService;
import jakarta.validation.Valid;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/guides")
public class GuideController {

    private final GuideService guides;

    public GuideController(GuideService guides) {
        this.guides = guides;
    }

    @GetMapping("/me")
    public GuideProfileResponse getMe(Authentication auth) {
        return guides.getMe(auth.getName());
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
                                                  @RequestBody UpdateCertificateRequest req,
                                                  Authentication auth) {
        return guides.updateCertificate(auth.getName(), certificateId, req);
    }

    @DeleteMapping("/me/certificates/{certificateId}")
    public GuideProfileResponse deleteCertificate(@PathVariable String certificateId,
                                                  Authentication auth) {
        return guides.deleteCertificate(auth.getName(), certificateId);
    }
}

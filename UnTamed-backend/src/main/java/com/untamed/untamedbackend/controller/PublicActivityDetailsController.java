package com.untamed.untamedbackend.controller;

import com.untamed.untamedbackend.dto.PublicActivityDetailsResponse;
import com.untamed.untamedbackend.security.AuthenticatedUser;
import com.untamed.untamedbackend.service.PublicActivityDetailsService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/activities/public")
@RequiredArgsConstructor
public class PublicActivityDetailsController {

    private final PublicActivityDetailsService detailsService;

    @GetMapping("/{templateId}/details")
    public PublicActivityDetailsResponse getDetails(
            @PathVariable String templateId,
            Authentication auth
    ) {
        return detailsService.getDetails(templateId, resolveUserId(auth));
    }

    private String resolveUserId(Authentication auth) {
        if (auth == null || !auth.isAuthenticated()) {
            return null;
        }

        Object principal = auth.getPrincipal();
        if (principal instanceof AuthenticatedUser authenticatedUser) {
            return authenticatedUser.getId();
        }

        if (principal instanceof String s && "anonymousUser".equalsIgnoreCase(s)) {
            return null;
        }

        return null;
    }
}

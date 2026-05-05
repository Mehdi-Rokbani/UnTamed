package com.untamed.untamedbackend.dto;

public record GuideTemplateSessionsDashboardResponse(
        GuideTemplateDashboardTemplateDto template,
        PaginatedResponse<GuideTemplateSessionDashboardDto> sessions,
        GuideTemplateSessionsSummaryDto summary
) {}

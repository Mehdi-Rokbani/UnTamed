package com.untamed.untamedbackend.dto;

import java.util.List;

public record ProfileActivityFeedResponse(
        PaginatedResponse<ProfileCompletedTripDto> completedTrips,
        PaginatedResponse<ProfileReviewDto> reviews,
        List<ProfileTopCategoryDto> topCategories,
        ProfileActivitySummaryDto summary
) {}

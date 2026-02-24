package com.untamed.untamedbackend.dto;

import com.untamed.untamedbackend.model.ActivityStatus;

import java.time.Instant;

public record ActivitySessionResponse(
        String id,
        String templateId,
        String guideId,
        Instant date,
        int capacity,
        int bookedCount,
        ActivityStatus status,

        // include template data + rating so upcoming sessions show rating
        ActivityTemplateMiniDto template,
        RatingSummaryDto rating
) {}
package com.untamed.untamedbackend.dto;

import com.untamed.untamedbackend.model.ActivityStatus;

import java.time.Instant;

public record ActivitySessionResponse(
        String id,
        String templateId,
        String guideId,
        Instant startAt,
        Instant endAt,
        int capacity,
        int bookedCount,
        ActivityStatus status,
        String meetingPoint,
        String sessionNote,

        // include template data + rating so upcoming sessions show rating
        ActivityTemplateMiniDto template,
        RatingSummaryDto rating
) {}
package com.untamed.untamedbackend.admin;

import jakarta.validation.constraints.Size;

public record AdminGuideSuspendRequest(
        @Size(max = 1000) String reason,
        Boolean notifyGuide
) {}

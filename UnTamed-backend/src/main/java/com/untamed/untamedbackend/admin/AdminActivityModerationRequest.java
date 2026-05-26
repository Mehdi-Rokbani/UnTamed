package com.untamed.untamedbackend.admin;

import jakarta.validation.constraints.Size;

public record AdminActivityModerationRequest(
        @Size(max = 1000) String reason
) {}

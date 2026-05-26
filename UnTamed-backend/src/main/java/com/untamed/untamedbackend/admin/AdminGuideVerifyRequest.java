package com.untamed.untamedbackend.admin;

import jakarta.validation.constraints.Size;

public record AdminGuideVerifyRequest(
        @Size(max = 1000) String reason
) {}

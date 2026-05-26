package com.untamed.untamedbackend.admin;

import jakarta.validation.constraints.Size;

public record AdminCancelSessionRequest(
        @Size(max = 1000) String reason,
        Boolean notifyUsers
) {}

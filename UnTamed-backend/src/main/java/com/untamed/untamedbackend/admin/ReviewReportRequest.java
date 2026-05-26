package com.untamed.untamedbackend.admin;

import jakarta.validation.constraints.Size;

public record ReviewReportRequest(
        @Size(max = 2000)
        String adminNote
) {
}

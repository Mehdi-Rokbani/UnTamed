package com.untamed.untamedbackend.report;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record CreateReportRequest(
        @NotNull ReportTargetType targetType,
        @NotBlank String targetId,
        @NotNull ReportReason reason,
        @NotBlank
        @Size(min = 10, max = 2000)
        String description
) {
}

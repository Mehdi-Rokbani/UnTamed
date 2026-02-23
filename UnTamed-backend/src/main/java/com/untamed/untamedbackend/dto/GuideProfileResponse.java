package com.untamed.untamedbackend.dto;

import lombok.*;
import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class GuideProfileResponse {
    private List<CertificateResponse> certificates;
    private RatingSummaryResponse ratingSummary;
    private Integer experienceYears;
    private Boolean verifiedBadge;
}

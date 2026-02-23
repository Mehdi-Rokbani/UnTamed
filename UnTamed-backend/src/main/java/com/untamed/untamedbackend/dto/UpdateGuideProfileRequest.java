package com.untamed.untamedbackend.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;


@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class UpdateGuideProfileRequest {

    @Min(0)
    @Max(80)
    private Integer experienceYears;
}

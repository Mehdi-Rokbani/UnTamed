package com.untamed.untamedbackend.dto;

import lombok.*;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class RatingSummaryResponse {
    private Double average;
    private Integer count;
}

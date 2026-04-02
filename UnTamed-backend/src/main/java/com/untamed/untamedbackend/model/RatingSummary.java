package com.untamed.untamedbackend.model;

import lombok.*;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class RatingSummary {
    @Builder.Default
    private double average = 0.0;

    @Builder.Default
    private int count = 0;
}
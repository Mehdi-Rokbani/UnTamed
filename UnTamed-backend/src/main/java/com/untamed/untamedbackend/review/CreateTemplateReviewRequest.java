package com.untamed.untamedbackend.review;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class CreateTemplateReviewRequest {

    @Min(1)
    @Max(5)
    private int rating;

    @NotBlank
    private String comment;
}
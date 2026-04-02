package com.untamed.untamedbackend.review;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class ReplyReviewRequest {

    @NotBlank
    private String replyText;
}
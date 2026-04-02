package com.untamed.untamedbackend.review;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class ReviewUserDto {
    private String id;
    private String username;
    private String role;
    private String profileImageUrl;
}
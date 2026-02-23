// src/main/java/com/untamed/untamedbackend/dto/CategoryCreateRequest.java
package com.untamed.untamedbackend.dto;

import jakarta.validation.constraints.NotBlank;

public record CategoryCreateRequest(
        @NotBlank String slug,
        @NotBlank String name,
        String description,
        String iconUrl,
        Boolean active,
        Integer sortOrder
) {}

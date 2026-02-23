// src/main/java/com/untamed/untamedbackend/dto/ActivityImageDto.java
package com.untamed.untamedbackend.dto;

import jakarta.validation.constraints.NotBlank;

public record ActivityImageDto(
        @NotBlank String url,
        String publicId,
        String alt,
        Boolean cover,
        Integer order
) {}

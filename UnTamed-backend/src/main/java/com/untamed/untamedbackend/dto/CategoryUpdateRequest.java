// src/main/java/com/untamed/untamedbackend/dto/CategoryUpdateRequest.java
package com.untamed.untamedbackend.dto;

public record CategoryUpdateRequest(
        String slug,
        String name,
        String description,
        String iconUrl,
        Boolean active,
        Integer sortOrder
) {}

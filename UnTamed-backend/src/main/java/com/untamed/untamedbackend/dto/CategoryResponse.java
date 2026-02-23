// src/main/java/com/untamed/untamedbackend/dto/CategoryResponse.java
package com.untamed.untamedbackend.dto;

public record CategoryResponse(
        String id,
        String slug,
        String name,
        String description,
        String iconUrl,
        boolean active,
        int sortOrder
) {}

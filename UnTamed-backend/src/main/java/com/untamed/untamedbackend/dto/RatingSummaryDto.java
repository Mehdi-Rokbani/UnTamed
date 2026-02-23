// src/main/java/com/untamed/untamedbackend/dto/RatingSummaryDto.java
package com.untamed.untamedbackend.dto;

public record RatingSummaryDto(
        double average,
        int count
) {}

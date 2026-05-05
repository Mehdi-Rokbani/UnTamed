package com.untamed.untamedbackend.dto;

import org.springframework.data.domain.Page;

import java.util.List;

public record PaginatedResponse<T>(
        List<T> content,
        int page,
        int size,
        long totalElements,
        int totalPages,
        boolean last
) {
    public static <T> PaginatedResponse<T> from(Page<?> page, List<T> content) {
        return new PaginatedResponse<>(
                content,
                page.getNumber(),
                page.getSize(),
                page.getTotalElements(),
                page.getTotalPages(),
                page.isLast()
        );
    }

    public static <T> PaginatedResponse<T> of(List<T> content, int page, int size, long totalElements) {
        int safeSize = Math.max(1, size);
        int totalPages = totalElements == 0 ? 0 : (int) Math.ceil((double) totalElements / safeSize);

        return new PaginatedResponse<>(
                content,
                Math.max(0, page),
                safeSize,
                totalElements,
                totalPages,
                Math.max(0, page) + 1 >= totalPages
        );
    }
}

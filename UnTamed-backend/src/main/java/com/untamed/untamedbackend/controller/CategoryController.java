// src/main/java/com/untamed/untamedbackend/controller/CategoryController.java
package com.untamed.untamedbackend.controller;

import com.untamed.untamedbackend.dto.CategoryCreateRequest;
import com.untamed.untamedbackend.dto.CategoryResponse;
import com.untamed.untamedbackend.dto.CategoryUpdateRequest;
import com.untamed.untamedbackend.model.Category;
import com.untamed.untamedbackend.repository.CategoryRepository;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/categories")
public class CategoryController {

    private final CategoryRepository categoryRepo;

    public CategoryController(CategoryRepository categoryRepo) {
        this.categoryRepo = categoryRepo;
    }

    // Public (used by create activity form)
    @GetMapping
    public List<CategoryResponse> listActive() {
        return categoryRepo.findByActiveTrueOrderBySortOrderAscNameAsc()
                .stream()
                .map(this::toResponse)
                .toList();
    }

    // Admin endpoints (protect in SecurityConfig)
    @PostMapping
    public CategoryResponse create(@Valid @RequestBody CategoryCreateRequest req) {
        Category c = Category.builder()
                .slug(req.slug())
                .name(req.name())
                .description(req.description())
                .iconUrl(req.iconUrl())
                .active(req.active() == null || req.active())
                .sortOrder(req.sortOrder() == null ? 0 : req.sortOrder())
                .build();
        return toResponse(categoryRepo.save(c));
    }

    @PatchMapping("/{id}")
    public CategoryResponse update(@PathVariable String id, @RequestBody CategoryUpdateRequest req) {
        Category c = categoryRepo.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Category not found"));

        if (req.slug() != null && !req.slug().isBlank()) c.setSlug(req.slug());
        if (req.name() != null && !req.name().isBlank()) c.setName(req.name());
        if (req.description() != null) c.setDescription(req.description());
        if (req.iconUrl() != null) c.setIconUrl(req.iconUrl());
        if (req.active() != null) c.setActive(req.active());
        if (req.sortOrder() != null) c.setSortOrder(req.sortOrder());

        return toResponse(categoryRepo.save(c));
    }

    @DeleteMapping("/{id}")
    public void delete(@PathVariable String id) {
        categoryRepo.deleteById(id);
    }

    private CategoryResponse toResponse(Category c) {
        return new CategoryResponse(
                c.getId(),
                c.getSlug(),
                c.getName(),
                c.getDescription(),
                c.getIconUrl(),
                c.isActive(),
                c.getSortOrder()
        );
    }
}

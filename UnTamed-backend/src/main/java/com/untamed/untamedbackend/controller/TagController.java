// src/main/java/com/untamed/untamedbackend/controller/TagController.java
package com.untamed.untamedbackend.controller;

import com.untamed.untamedbackend.model.Tag;
import com.untamed.untamedbackend.model.TagType;
import com.untamed.untamedbackend.repository.TagRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/tags")
@RequiredArgsConstructor
public class TagController {

    private final TagRepository tagRepository;

    @GetMapping
    public List<Tag> getActiveTags(@RequestParam(required = false) TagType type) {
        if (type != null) {
            return tagRepository.findByTypeAndActiveTrueOrderBySortOrderAscNameAsc(type);
        }

        return tagRepository.findByActiveTrueOrderBySortOrderAscNameAsc();
    }
}
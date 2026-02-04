package com.untamed.untamedbackend.controller;

import com.untamed.untamedbackend.dto.ActivityCreateRequest;
import com.untamed.untamedbackend.dto.ActivityResponse;
import com.untamed.untamedbackend.dto.ActivityUpdateRequest;
import com.untamed.untamedbackend.service.ActivityService;
import jakarta.validation.Valid;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/activities")
public class ActivityController {

    private final ActivityService service;

    public ActivityController(ActivityService service) {
        this.service = service;
    }

    @PostMapping("/create")
    public ActivityResponse create(@Valid @RequestBody ActivityCreateRequest req, Authentication auth) {
        String email = (String) auth.getPrincipal();
        return service.create(req, email);
    }

    @GetMapping("/GetAll")
    public List<ActivityResponse> list() {
        return service.listAll();
    }

    @GetMapping("/{id}")
    public ActivityResponse detail(@PathVariable String id) {
        return service.getById(id);
    }

    @PutMapping("/update/{id}")
    public ActivityResponse update(
            @PathVariable String id,
            @Valid @RequestBody ActivityUpdateRequest req,
            Authentication auth
    ) {
        String email = (String) auth.getPrincipal();
        return service.update(id, req, email);
    }
}

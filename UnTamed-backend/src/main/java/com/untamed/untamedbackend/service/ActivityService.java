package com.untamed.untamedbackend.service;

import com.untamed.untamedbackend.dto.ActivityCreateRequest;
import com.untamed.untamedbackend.dto.ActivityResponse;
import com.untamed.untamedbackend.dto.ActivityUpdateRequest;
import com.untamed.untamedbackend.model.Activity;
import com.untamed.untamedbackend.model.Role;
import com.untamed.untamedbackend.model.User;
import com.untamed.untamedbackend.repository.ActivityRepository;
import com.untamed.untamedbackend.repository.UserRepository;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.List;

@Service
public class ActivityService {

    private final ActivityRepository activityRepo;
    private final UserRepository userRepo;

    public ActivityService(ActivityRepository activityRepo, UserRepository userRepo) {
        this.activityRepo = activityRepo;
        this.userRepo = userRepo;
    }

    public List<ActivityResponse> listAll() {
        return activityRepo.findAll().stream().map(this::toResponse).toList();
    }

    public ActivityResponse getById(String id) {
        Activity a = activityRepo.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Activity not found"));
        return toResponse(a);
    }


    public ActivityResponse create(ActivityCreateRequest req, String authEmail) {
        User guide = userRepo.findByEmail(authEmail)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));

        if (guide.getRole() != Role.GUIDE) {
            throw new IllegalArgumentException("Only GUIDE can create an activity");
        }

        Activity a = Activity.builder()
                .title(req.title())
                .description(req.description())
                .date(req.date())
                .capacity(req.capacity())
                .published(false)
                .guideId(guide.getId())
                .build();

        Activity saved = activityRepo.save(a);
        return toResponse(saved);
    }



    public ActivityResponse update(String activityId, ActivityUpdateRequest req, String authEmail) {

        User guide = userRepo.findByEmail(authEmail)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));

        if (guide.getRole() != Role.GUIDE) {
            throw new IllegalArgumentException("Only GUIDE can update activities");
        }

        // Owner check: only update if activity belongs to this guide
        Activity a = activityRepo.findByIdAndGuideId(activityId, guide.getId())
                .orElseThrow(() -> new IllegalArgumentException("Not allowed or activity not found"));

        if (req.title() != null && !req.title().isBlank()) a.setTitle(req.title());
        if (req.description() != null && !req.description().isBlank()) a.setDescription(req.description());

        if (req.date() != null) {
            if (!req.date().isAfter(Instant.now())) {
                throw new IllegalArgumentException("Date must be in the future");
            }
            a.setDate(req.date());
        }

        if (req.capacity() != null) {
            if (req.capacity() < 1) throw new IllegalArgumentException("Capacity must be >= 1");
            a.setCapacity(req.capacity());
        }

        Activity saved = activityRepo.save(a);
        return toResponse(saved);
    }
    private ActivityResponse toResponse(Activity a) {
        return new ActivityResponse(
                a.getId(),
                a.getTitle(),
                a.getDescription(),
                a.getDate(),
                a.getCapacity(),
                a.isPublished(),
                a.getGuideId()
        );
    }

}

// src/main/java/com/untamed/untamedbackend/service/ActivityService.java
package com.untamed.untamedbackend.service;

import com.untamed.untamedbackend.dto.*;
import com.untamed.untamedbackend.model.*;
import com.untamed.untamedbackend.repository.ActivityRepository;
import com.untamed.untamedbackend.repository.AddressRepository;
import com.untamed.untamedbackend.repository.UserRepository;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.geo.GeoJsonPoint;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;
import com.untamed.untamedbackend.service.GeoService;


import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Objects;

@Service
public class ActivityService {

    private final ActivityRepository activityRepo;
    private final UserRepository userRepo;
    private final AddressRepository addressRepo;
    private final MongoTemplate mongo;
    private final CloudinaryService cloudinaryService;
    private final GeoService GeoService;

    public ActivityService(
            ActivityRepository activityRepo,
            UserRepository userRepo,
            AddressRepository addressRepo,
            MongoTemplate mongo,
            CloudinaryService cloudinaryService,
            GeoService Geoservice
    ) {
        this.activityRepo = activityRepo;
        this.userRepo = userRepo;
        this.addressRepo = addressRepo;
        this.mongo = mongo;
        this.cloudinaryService = cloudinaryService;
        this.GeoService = Geoservice;
    }

    // -----------------------------
    // Reads
    // -----------------------------

    public List<ActivityResponse> listPublished() {
        return activityRepo.findByStatus(ActivityStatus.PUBLISHED)
                .stream()
                .map(this::toResponse)
                .toList();
    }

    public List<ActivityResponse> listMine(String authEmail) {
        User guide = getGuideByEmail(authEmail);
        return activityRepo.findByGuideId(guide.getId())
                .stream()
                .map(this::toResponse)
                .toList();
    }

    public ActivityResponse getById(String id, String authEmailOrNull) {
        Activity a = activityRepo.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Activity not found"));

        // If not published, only guide owner can see it
        if (a.getStatus() != ActivityStatus.PUBLISHED) {
            if (authEmailOrNull == null) throw new IllegalArgumentException("Activity not found");
            User u = userRepo.findByEmail(authEmailOrNull)
                    .orElseThrow(() -> new IllegalArgumentException("User not found"));
            if (!a.getGuideId().equals(u.getId())) throw new IllegalArgumentException("Activity not found");
        }

        return toResponse(a);
    }

    public List<ActivityResponse> listAll() {
        return activityRepo.findAll()
                .stream()
                .map(this::toResponse)
                .toList();
    }

    // -----------------------------
    // Writes
    // -----------------------------
    @Transactional
    public ActivityResponse create(ActivityCreateRequest req, String authEmail) {

        Address address = GeoService.resolveUpsertAndBumpUses(req.address());

        User guide = getGuideByEmail(authEmail);

        if (req.date() == null || !req.date().isAfter(Instant.now())) {
            throw new IllegalArgumentException("Date must be in the future");
        }


        incrementUsesCount(address.getId());

        // Snapshot geo point for fast "near me" queries (no join)
        GeoJsonPoint activityLocation = address.getLocation();
        if (activityLocation == null && address.getLongitude() != null && address.getLatitude() != null) {
            activityLocation = new GeoJsonPoint(address.getLongitude(), address.getLatitude()); // (lon, lat)
        }

        Activity a = Activity.builder()
                .title(req.title())
                .description(req.description())
                .difficulty(req.difficulty())
                .price(req.price())
                .date(req.date())
                .capacity(req.capacity())
                .bookedCount(0)
                .status(ActivityStatus.DRAFT)
                .tags(req.tags() == null ? List.of() : req.tags())
                .rating(RatingSummary.builder().average(0.0).count(0).build())
                .images(toImageModels(req.images()))        // DTO -> Model
                .categoryIds(req.categoryIds())
                .guideId(guide.getId())
                .addressId(address.getId())
                .location(activityLocation)
                .build();

        return toResponse(activityRepo.save(a));
    }

    public ActivityResponse update(String activityId, ActivityUpdateRequest req, String authEmail) {
        User guide = getGuideByEmail(authEmail);

        Activity a = activityRepo.findByIdAndGuideId(activityId, guide.getId())
                .orElseThrow(() -> new IllegalArgumentException("Not allowed or activity not found"));

        if (req.title() != null && !req.title().isBlank()) a.setTitle(req.title());
        if (req.description() != null && !req.description().isBlank()) a.setDescription(req.description());
        if (req.difficulty() != null) a.setDifficulty(req.difficulty());

        if (req.price() != null) {
            if (req.price().signum() < 0) throw new IllegalArgumentException("Price must be >= 0");
            a.setPrice(req.price());
        }

        if (req.date() != null) {
            if (!req.date().isAfter(Instant.now())) throw new IllegalArgumentException("Date must be in the future");
            a.setDate(req.date());
        }

        if (req.capacity() != null) {
            if (req.capacity() < 1) throw new IllegalArgumentException("Capacity must be >= 1");
            a.setCapacity(req.capacity());
        }

        // categories
        if (req.categoryIds() != null) {
            if (req.categoryIds().isEmpty()) throw new IllegalArgumentException("At least one category is required");
            a.setCategoryIds(req.categoryIds());
        }

        // images (manual set via DTO)
        if (req.images() != null) {
            if (req.images().isEmpty()) throw new IllegalArgumentException("At least one image is required");
            a.setImages(toImageModels(req.images()));
        }

        // tags
        if (req.tags() != null) {
            a.setTags(req.tags());
        }

        // address (and keep Activity.location snapshot in sync)
        if (req.address() != null) {
            Address newAddress = getOrCreateAddress(req.address());

            if (a.getAddressId() == null || !a.getAddressId().equals(newAddress.getId())) {
                if (a.getAddressId() != null) decrementUsesCount(a.getAddressId());
                a.setAddressId(newAddress.getId());
                incrementUsesCount(newAddress.getId());
            }

            GeoJsonPoint newLoc = newAddress.getLocation();
            if (newLoc == null && newAddress.getLongitude() != null && newAddress.getLatitude() != null) {
                newLoc = new GeoJsonPoint(newAddress.getLongitude(), newAddress.getLatitude()); // (lon, lat)
            }
            a.setLocation(newLoc);
        }

        // status updates (optional: restrict transitions)
        if (req.status() != null) {
            a.setStatus(req.status());
        }

        return toResponse(activityRepo.save(a));
    }

    /**
     * Backward compatible method.
     * - true  => PUBLISHED
     * - false => DRAFT
     */
    public ActivityResponse setPublished(String activityId, boolean published, String authEmail) {
        return setStatus(activityId, published ? ActivityStatus.PUBLISHED : ActivityStatus.DRAFT, authEmail);
    }

    public ActivityResponse setStatus(String activityId, ActivityStatus status, String authEmail) {
        User guide = getGuideByEmail(authEmail);

        Activity a = activityRepo.findByIdAndGuideId(activityId, guide.getId())
                .orElseThrow(() -> new IllegalArgumentException("Not allowed or activity not found"));

        if (status == ActivityStatus.PUBLISHED) {
            // must have a location + images + categories before publishing
            if (a.getAddressId() == null || a.getAddressId().isBlank()) {
                throw new IllegalArgumentException("Activity must have a location before publishing");
            }
            if (a.getLocation() == null) {
                throw new IllegalArgumentException("Activity must have coordinates before publishing");
            }
            if (a.getImages() == null || a.getImages().isEmpty()) {
                throw new IllegalArgumentException("Activity must have at least one image before publishing");
            }
            if (a.getCategoryIds() == null || a.getCategoryIds().isEmpty()) {
                throw new IllegalArgumentException("Activity must have at least one category before publishing");
            }
            if (a.getDate() == null || !a.getDate().isAfter(Instant.now())) {
                throw new IllegalArgumentException("Activity date must be in the future before publishing");
            }
        }

        a.setStatus(status);
        return toResponse(activityRepo.save(a));
    }

    // -----------------------------
    // Images (Cloudinary-backed)
    // -----------------------------

    public ActivityResponse addImage(String activityId, MultipartFile file, boolean cover, String alt, String authEmail) {
        User guide = getGuideByEmail(authEmail);

        Activity a = activityRepo.findByIdAndGuideId(activityId, guide.getId())
                .orElseThrow(() -> new IllegalArgumentException("Not allowed or activity not found"));

        // Upload first
        CloudinaryService.UploadResult up = cloudinaryService.uploadAvatar(file, "activities/" + activityId);

        List<ActivityImage> imgs = a.getImages() == null ? new ArrayList<>() : new ArrayList<>(a.getImages());

        int nextOrder = imgs.stream().mapToInt(ActivityImage::getOrder).max().orElse(-1) + 1;

        ActivityImage newImg = ActivityImage.builder()
                .url(up.url())
                .publicId(up.publicId())
                .alt(alt)
                .cover(cover)
                .order(nextOrder)
                .build();

        // Cover rules:
        // - if requested cover: unset others
        // - else: if no cover exists yet, make it cover
        if (cover) {
            for (ActivityImage i : imgs) i.setCover(false);
        } else {
            boolean hasCover = imgs.stream().anyMatch(ActivityImage::isCover);
            if (!hasCover) newImg.setCover(true);
        }

        imgs.add(newImg);

        a.setImages(imgs);
        return toResponse(activityRepo.save(a));
    }

    public ActivityResponse deleteImage(String activityId, String publicId, String authEmail) {
        User guide = getGuideByEmail(authEmail);

        Activity a = activityRepo.findByIdAndGuideId(activityId, guide.getId())
                .orElseThrow(() -> new IllegalArgumentException("Not allowed or activity not found"));

        if (publicId == null || publicId.isBlank()) throw new IllegalArgumentException("publicId is required");

        List<ActivityImage> imgs = a.getImages() == null ? new ArrayList<>() : new ArrayList<>(a.getImages());

        ActivityImage target = imgs.stream()
                .filter(i -> publicId.equals(i.getPublicId()))
                .findFirst()
                .orElseThrow(() -> new IllegalArgumentException("Image not found"));

        boolean wasCover = target.isCover();

        // Delete from Cloudinary
        cloudinaryService.deleteByPublicId(target.getPublicId());

        // Remove from list
        imgs.remove(target);

        // If cover deleted, promote lowest-order image
        if (wasCover && !imgs.isEmpty()) {
            ActivityImage first = imgs.stream()
                    .min(Comparator.comparingInt(ActivityImage::getOrder))
                    .orElseThrow();
            for (ActivityImage i : imgs) i.setCover(false);
            first.setCover(true);
        }

        a.setImages(imgs);
        return toResponse(activityRepo.save(a));
    }

    public ActivityResponse setCoverImage(String activityId, String publicId, String authEmail) {
        User guide = getGuideByEmail(authEmail);

        Activity a = activityRepo.findByIdAndGuideId(activityId, guide.getId())
                .orElseThrow(() -> new IllegalArgumentException("Not allowed or activity not found"));

        if (publicId == null || publicId.isBlank()) throw new IllegalArgumentException("publicId is required");

        List<ActivityImage> imgs = a.getImages() == null ? new ArrayList<>() : new ArrayList<>(a.getImages());

        boolean found = false;
        for (ActivityImage i : imgs) {
            boolean isTarget = publicId.equals(i.getPublicId());
            i.setCover(isTarget);
            if (isTarget) found = true;
        }
        if (!found) throw new IllegalArgumentException("Image not found");

        a.setImages(imgs);
        return toResponse(activityRepo.save(a));
    }

    /**
     * Optional helper for drag & drop ordering.
     * Body: ["publicId1","publicId2",...]
     */
    public ActivityResponse reorderImages(String activityId, List<String> publicIdsInOrder, String authEmail) {
        User guide = getGuideByEmail(authEmail);

        Activity a = activityRepo.findByIdAndGuideId(activityId, guide.getId())
                .orElseThrow(() -> new IllegalArgumentException("Not allowed or activity not found"));

        if (publicIdsInOrder == null) throw new IllegalArgumentException("publicIdsInOrder is required");

        List<ActivityImage> imgs = a.getImages() == null ? new ArrayList<>() : new ArrayList<>(a.getImages());
        if (imgs.isEmpty()) return toResponse(a);

        // Ensure list contains the same set of publicIds (ignore nulls)
        List<String> existingIds = imgs.stream()
                .map(ActivityImage::getPublicId)
                .filter(Objects::nonNull)
                .toList();

        List<String> wanted = publicIdsInOrder.stream().filter(Objects::nonNull).toList();

        // If mismatch, reject (prevents accidental loss)
        if (existingIds.size() != wanted.size() || !existingIds.containsAll(wanted)) {
            throw new IllegalArgumentException("Invalid reorder list");
        }

        // Re-assign order based on provided sequence
        for (int idx = 0; idx < wanted.size(); idx++) {
            String id = wanted.get(idx);
            for (ActivityImage img : imgs) {
                if (id.equals(img.getPublicId())) {
                    img.setOrder(idx);
                    break;
                }
            }
        }

        a.setImages(imgs);
        return toResponse(activityRepo.save(a));
    }

    // -----------------------------
    // Helpers
    // -----------------------------

    private User getGuideByEmail(String authEmail) {
        User u = userRepo.findByEmail(authEmail)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));
        if (u.getRole() != Role.GUIDE) throw new IllegalArgumentException("Only GUIDE can manage activities");
        return u;
    }

    private Address getOrCreateAddress(AddressPickDto dto) {
        if (dto == null) throw new IllegalArgumentException("Address is required");
        if (dto.provider() == null || dto.provider().isBlank()) {
            throw new IllegalArgumentException("provider is required");
        }
        if (dto.providerPlaceId() == null || dto.providerPlaceId().isBlank()) {
            throw new IllegalArgumentException("providerPlaceId is required");
        }

        String provider = dto.provider();

        return addressRepo.findByProviderAndProviderPlaceId(provider, dto.providerPlaceId())
                .orElseGet(() -> {
                    GeoJsonPoint loc = null;
                    if (dto.longitude() != null && dto.latitude() != null) {
                        loc = new GeoJsonPoint(dto.longitude(), dto.latitude()); // (lon, lat)
                    }

                    String normalizedKey = null;
                    if (dto.latitude() != null && dto.longitude() != null) {
                        normalizedKey = normalize(dto.latitude(), dto.longitude(), 5);
                    }

                    return addressRepo.save(
                            Address.builder()
                                    .provider(provider)
                                    .providerPlaceId(dto.providerPlaceId())
                                    .displayName(dto.displayName())
                                    .governorate(dto.governorate())
                                    .delegation(dto.delegation())
                                    .locality(dto.locality())
                                    .latitude(dto.latitude())
                                    .longitude(dto.longitude())
                                    .location(loc)
                                    .normalizedKey(normalizedKey)
                                    .usesCount(0)
                                    .build()
                    );
                });
    }

    private void incrementUsesCount(String addressId) {
        if (addressId == null || addressId.isBlank()) return;
        mongo.updateFirst(
                Query.query(Criteria.where("_id").is(addressId)),
                new Update().inc("usesCount", 1),
                Address.class
        );
    }

    private void decrementUsesCount(String addressId) {
        if (addressId == null || addressId.isBlank()) return;

        addressRepo.findById(addressId).ifPresent(addr -> {
            if (addr.getUsesCount() <= 0) return;
            mongo.updateFirst(
                    Query.query(Criteria.where("_id").is(addressId).and("usesCount").gt(0)),
                    new Update().inc("usesCount", -1),
                    Address.class
            );
        });
    }

    private String normalize(double lat, double lon, int decimals) {
        double p = Math.pow(10, decimals);
        double rlat = Math.round(lat * p) / p;
        double rlon = Math.round(lon * p) / p;
        return rlat + ":" + rlon;
    }

    // --------- DTO <-> Model mappers ---------

    private List<ActivityImage> toImageModels(List<ActivityImageDto> dtos) {
        if (dtos == null) return List.of();
        return dtos.stream().map(d -> ActivityImage.builder()
                .url(d.url())
                .publicId(d.publicId())
                .alt(d.alt())
                .cover(Boolean.TRUE.equals(d.cover()))
                .order(d.order() == null ? 0 : d.order())
                .build()
        ).toList();
    }

    private List<ActivityImageDto> toImageDtos(List<ActivityImage> models) {
        if (models == null) return List.of();
        return models.stream().map(m -> new ActivityImageDto(
                m.getUrl(),
                m.getPublicId(),
                m.getAlt(),
                m.isCover(),
                m.getOrder()
        )).toList();
    }

    private ActivityResponse toResponse(Activity a) {
        Address addr = (a.getAddressId() == null) ? null :
                addressRepo.findById(a.getAddressId()).orElse(null);

        AddressPickDto addrDto = (addr == null) ? null : new AddressPickDto(
                addr.getProvider(),
                addr.getProviderPlaceId(),
                addr.getDisplayName(),
                addr.getGovernorate(),
                addr.getDelegation(),
                addr.getLocality(),
                addr.getLatitude(),
                addr.getLongitude()
        );

        RatingSummary r = a.getRating() == null
                ? RatingSummary.builder().average(0.0).count(0).build()
                : a.getRating();

        RatingSummaryDto ratingDto = new RatingSummaryDto(r.getAverage(), r.getCount());

        return new ActivityResponse(
                a.getId(),
                a.getTitle(),
                a.getDescription(),
                a.getDifficulty(),
                a.getPrice(),
                a.getDate(),
                a.getCapacity(),

                // old field for frontend compatibility
                a.getStatus() == ActivityStatus.PUBLISHED,

                a.getGuideId(),
                a.getAddressId(),
                addrDto,

                // new fields
                a.getBookedCount(),
                a.getTags() == null ? List.of() : a.getTags(),
                ratingDto,
                a.getStatus(),
                toImageDtos(a.getImages()),
                a.getCategoryIds() == null ? List.of() : a.getCategoryIds(),
                a.getCreatedAt(),
                a.getUpdatedAt()
        );
    }
}

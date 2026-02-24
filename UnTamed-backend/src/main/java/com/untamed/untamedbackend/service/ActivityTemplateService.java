package com.untamed.untamedbackend.service;

import com.untamed.untamedbackend.dto.*;
import com.untamed.untamedbackend.model.*;
import com.untamed.untamedbackend.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.geo.GeoJsonPoint;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.util.*;
import java.util.Comparator;

@Service
@RequiredArgsConstructor
public class ActivityTemplateService {

    private final ActivityTemplateRepository templateRepo;
    private final ActivitySessionRepository sessionRepo; // used for delete blocking
    private final UserRepository userRepo;
    private final AddressRepository addressRepo;
    private final MongoTemplate mongo;
    private final CloudinaryService cloudinaryService;
    private final GeoService geoService;

    // -------- Reads --------

    public List<ActivityTemplateResponse> listMineTemplates(String authEmail) {
        User guide = getGuideByEmail(authEmail);
        return templateRepo.findByGuideId(guide.getId()).stream()
                .map(this::toTemplateResponse)
                .toList();
    }

    public ActivityTemplateResponse getTemplate(String templateId, String authEmail) {
        User guide = getGuideByEmail(authEmail);
        ActivityTemplate t = templateRepo.findByIdAndGuideId(templateId, guide.getId())
                .orElseThrow(() -> new IllegalArgumentException("Template not found"));
        return toTemplateResponse(t);
    }

    // -------- Writes --------

    public ActivityTemplateResponse createTemplate(ActivityTemplateCreateRequest req, String authEmail) {
        User guide = getGuideByEmail(authEmail);

        Address address = geoService.resolveUpsertAndBumpUses(req.address());
        incrementUsesCount(address.getId());

        GeoJsonPoint loc = address.getLocation();
        if (loc == null && address.getLongitude() != null && address.getLatitude() != null) {
            loc = new GeoJsonPoint(address.getLongitude(), address.getLatitude());
        }

        ActivityTemplate t = ActivityTemplate.builder()
                .title(req.title())
                .description(req.description())
                .difficulty(req.difficulty())
                .price(req.price())
                .tags(req.tags() == null ? List.of() : req.tags())
                .images(toImageModels(req.images()))
                .categoryIds(req.categoryIds())
                .guideId(guide.getId())
                .addressId(address.getId())
                .location(loc)
                .rating(RatingSummary.builder().average(0.0).count(0).build())
                .build();

        return toTemplateResponse(templateRepo.save(t));
    }

    public ActivityTemplateResponse updateTemplate(String templateId, ActivityTemplateUpdateRequest req, String authEmail) {
        User guide = getGuideByEmail(authEmail);

        ActivityTemplate t = templateRepo.findByIdAndGuideId(templateId, guide.getId())
                .orElseThrow(() -> new IllegalArgumentException("Not allowed or template not found"));

        if (req.title() != null && !req.title().isBlank()) t.setTitle(req.title());
        if (req.description() != null && !req.description().isBlank()) t.setDescription(req.description());
        if (req.difficulty() != null) t.setDifficulty(req.difficulty());

        if (req.price() != null) {
            if (req.price().signum() < 0) throw new IllegalArgumentException("Price must be >= 0");
            t.setPrice(req.price());
        }

        if (req.categoryIds() != null) {
            if (req.categoryIds().isEmpty()) throw new IllegalArgumentException("At least one category is required");
            t.setCategoryIds(req.categoryIds());
        }

        if (req.images() != null) {
            if (req.images().isEmpty()) throw new IllegalArgumentException("At least one image is required");
            t.setImages(toImageModels(req.images()));
        }

        if (req.tags() != null) t.setTags(req.tags());

        // address + location sync
        if (req.address() != null) {
            Address newAddress = getOrCreateAddress(req.address());

            if (t.getAddressId() == null || !t.getAddressId().equals(newAddress.getId())) {
                if (t.getAddressId() != null) decrementUsesCount(t.getAddressId());
                t.setAddressId(newAddress.getId());
                incrementUsesCount(newAddress.getId());
            }

            GeoJsonPoint newLoc = newAddress.getLocation();
            if (newLoc == null && newAddress.getLongitude() != null && newAddress.getLatitude() != null) {
                newLoc = new GeoJsonPoint(newAddress.getLongitude(), newAddress.getLatitude());
            }
            t.setLocation(newLoc);
        }

        return toTemplateResponse(templateRepo.save(t));
    }

    public void deleteTemplate(String templateId, String authEmail) {
        User guide = getGuideByEmail(authEmail);

        ActivityTemplate t = templateRepo.findByIdAndGuideId(templateId, guide.getId())
                .orElseThrow(() -> new IllegalArgumentException("Not allowed or template not found"));

        // BLOCK delete if sessions exist (your rule)
        if (sessionRepo.existsByTemplateId(templateId)) {
            throw new IllegalStateException("Cannot delete template with existing sessions");
        }

        // clean address uses
        if (t.getAddressId() != null) decrementUsesCount(t.getAddressId());

        // optional: delete cloudinary images too (if you want hard cleanup)
        // for (ActivityImage img : Optional.ofNullable(t.getImages()).orElse(List.of())) {
        //     if (img.getPublicId() != null) cloudinaryService.deleteByPublicId(img.getPublicId());
        // }

        templateRepo.deleteById(t.getId());
    }

    // -------- Images (Cloudinary) now operate on TEMPLATE --------

    public ActivityTemplateResponse addImage(String templateId, MultipartFile file, boolean cover, String alt, String authEmail) {
        User guide = getGuideByEmail(authEmail);

        ActivityTemplate t = templateRepo.findByIdAndGuideId(templateId, guide.getId())
                .orElseThrow(() -> new IllegalArgumentException("Not allowed or template not found"));

        CloudinaryService.UploadResult up = cloudinaryService.uploadAvatar(file, "activity-templates/" + templateId);

        List<ActivityImage> imgs = t.getImages() == null ? new ArrayList<>() : new ArrayList<>(t.getImages());
        int nextOrder = imgs.stream().mapToInt(ActivityImage::getOrder).max().orElse(-1) + 1;

        ActivityImage newImg = ActivityImage.builder()
                .url(up.url())
                .publicId(up.publicId())
                .alt(alt)
                .cover(cover)
                .order(nextOrder)
                .build();

        if (cover) {
            for (ActivityImage i : imgs) i.setCover(false);
        } else {
            boolean hasCover = imgs.stream().anyMatch(ActivityImage::isCover);
            if (!hasCover) newImg.setCover(true);
        }

        imgs.add(newImg);
        t.setImages(imgs);

        return toTemplateResponse(templateRepo.save(t));
    }

    public ActivityTemplateResponse deleteImage(String templateId, String publicId, String authEmail) {
        User guide = getGuideByEmail(authEmail);

        ActivityTemplate t = templateRepo.findByIdAndGuideId(templateId, guide.getId())
                .orElseThrow(() -> new IllegalArgumentException("Not allowed or template not found"));

        if (publicId == null || publicId.isBlank()) throw new IllegalArgumentException("publicId is required");

        List<ActivityImage> imgs = t.getImages() == null ? new ArrayList<>() : new ArrayList<>(t.getImages());
        ActivityImage target = imgs.stream()
                .filter(i -> publicId.equals(i.getPublicId()))
                .findFirst()
                .orElseThrow(() -> new IllegalArgumentException("Image not found"));

        boolean wasCover = target.isCover();

        cloudinaryService.deleteByPublicId(target.getPublicId());
        imgs.remove(target);

        if (wasCover && !imgs.isEmpty()) {
            ActivityImage first = imgs.stream().min(Comparator.comparingInt(ActivityImage::getOrder)).orElseThrow();
            for (ActivityImage i : imgs) i.setCover(false);
            first.setCover(true);
        }

        t.setImages(imgs);
        return toTemplateResponse(templateRepo.save(t));
    }

    public ActivityTemplateResponse setCoverImage(String templateId, String publicId, String authEmail) {
        User guide = getGuideByEmail(authEmail);

        ActivityTemplate t = templateRepo.findByIdAndGuideId(templateId, guide.getId())
                .orElseThrow(() -> new IllegalArgumentException("Not allowed or template not found"));

        List<ActivityImage> imgs = t.getImages() == null ? new ArrayList<>() : new ArrayList<>(t.getImages());
        boolean found = false;

        for (ActivityImage i : imgs) {
            boolean isTarget = publicId.equals(i.getPublicId());
            i.setCover(isTarget);
            if (isTarget) found = true;
        }
        if (!found) throw new IllegalArgumentException("Image not found");

        t.setImages(imgs);
        return toTemplateResponse(templateRepo.save(t));
    }

    public ActivityTemplateResponse reorderImages(String templateId, List<String> publicIdsInOrder, String authEmail) {
        User guide = getGuideByEmail(authEmail);

        ActivityTemplate t = templateRepo.findByIdAndGuideId(templateId, guide.getId())
                .orElseThrow(() -> new IllegalArgumentException("Not allowed or template not found"));

        List<ActivityImage> imgs = t.getImages() == null ? new ArrayList<>() : new ArrayList<>(t.getImages());
        if (imgs.isEmpty()) return toTemplateResponse(t);

        List<String> existingIds = imgs.stream().map(ActivityImage::getPublicId).filter(Objects::nonNull).toList();
        List<String> wanted = publicIdsInOrder.stream().filter(Objects::nonNull).toList();

        if (existingIds.size() != wanted.size() || !existingIds.containsAll(wanted)) {
            throw new IllegalArgumentException("Invalid reorder list");
        }

        for (int idx = 0; idx < wanted.size(); idx++) {
            String id = wanted.get(idx);
            for (ActivityImage img : imgs) {
                if (id.equals(img.getPublicId())) {
                    img.setOrder(idx);
                    break;
                }
            }
        }

        t.setImages(imgs);
        return toTemplateResponse(templateRepo.save(t));
    }

    // -------- Helpers (copied from your service) --------

    private User getGuideByEmail(String authEmail) {
        User u = userRepo.findByEmail(authEmail).orElseThrow(() -> new IllegalArgumentException("User not found"));
        if (u.getRole() != Role.GUIDE) throw new IllegalArgumentException("Only GUIDE can manage activities");
        return u;
    }

    private Address getOrCreateAddress(AddressPickDto dto) {
        if (dto == null) throw new IllegalArgumentException("Address is required");
        if (dto.provider() == null || dto.provider().isBlank()) throw new IllegalArgumentException("provider is required");
        if (dto.providerPlaceId() == null || dto.providerPlaceId().isBlank()) throw new IllegalArgumentException("providerPlaceId is required");

        String provider = dto.provider();

        return addressRepo.findByProviderAndProviderPlaceId(provider, dto.providerPlaceId())
                .orElseGet(() -> {
                    GeoJsonPoint loc = null;
                    if (dto.longitude() != null && dto.latitude() != null) {
                        loc = new GeoJsonPoint(dto.longitude(), dto.latitude());
                    }

                    String normalizedKey = null;
                    if (dto.latitude() != null && dto.longitude() != null) {
                        normalizedKey = normalize(dto.latitude(), dto.longitude(), 5);
                    }

                    return addressRepo.save(Address.builder()
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
                            .build());
                });
    }

    private void incrementUsesCount(String addressId) {
        if (addressId == null || addressId.isBlank()) return;
        mongo.updateFirst(Query.query(Criteria.where("_id").is(addressId)),
                new Update().inc("usesCount", 1), Address.class);
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

    private ActivityTemplateResponse toTemplateResponse(ActivityTemplate t) {
        RatingSummary r = t.getRating() == null ? RatingSummary.builder().average(0.0).count(0).build() : t.getRating();
        RatingSummaryDto ratingDto = new RatingSummaryDto(r.getAverage(), r.getCount());

        return new ActivityTemplateResponse(
                t.getId(),
                t.getTitle(),
                t.getDescription(),
                t.getDifficulty(),
                t.getPrice(),
                t.getGuideId(),
                t.getAddressId(),
                t.getTags() == null ? List.of() : t.getTags(),
                ratingDto,
                toImageDtos(t.getImages()),
                t.getCategoryIds() == null ? List.of() : t.getCategoryIds(),
                t.getCreatedAt(),
                t.getUpdatedAt()
        );
    }

    private List<ActivityImageDto> toImageDtos(List<ActivityImage> models) {
        if (models == null) return List.of();
        return models.stream().map(m -> new ActivityImageDto(
                m.getUrl(), m.getPublicId(), m.getAlt(), m.isCover(), m.getOrder()
        )).toList();
    }
}
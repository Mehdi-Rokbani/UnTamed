package com.untamed.untamedbackend.service;

import com.cloudinary.Cloudinary;
import com.cloudinary.utils.ObjectUtils;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.Map;
import java.util.Set;

@Service
public class CloudinaryService {

    private static final long MAX_BYTES = 5L * 1024 * 1024; // 5MB
    private static final Set<String> ALLOWED = Set.of("image/jpeg", "image/png", "image/webp");

    private final Cloudinary cloudinary;

    public CloudinaryService(Cloudinary cloudinary) {
        this.cloudinary = cloudinary;
    }

    public UploadResult uploadAvatar(MultipartFile file, String folder) {
        validateImage(file);

        try {
            Map<?, ?> res = cloudinary.uploader().upload(
                    file.getBytes(),
                    ObjectUtils.asMap(
                            "folder", folder,
                            "resource_type", "image"
                            // Optional transformations can be added later
                    )
            );

            String secureUrl = (String) res.get("secure_url");
            String publicId = (String) res.get("public_id");

            return new UploadResult(secureUrl, publicId);

        } catch (IOException e) {
            throw new IllegalStateException("Cloudinary upload failed");
        }
    }

    public void deleteByPublicId(String publicId) {
        if (publicId == null || publicId.isBlank()) return;

        try {
            cloudinary.uploader().destroy(publicId, ObjectUtils.asMap("resource_type", "image"));
        } catch (Exception ignored) {
            // If delete fails, we still allow user update to proceed
        }
    }

    private void validateImage(MultipartFile file) {
        if (file == null || file.isEmpty()) throw new IllegalArgumentException("File is required");
        if (file.getSize() > MAX_BYTES) throw new IllegalArgumentException("File too large (max 5MB)");
        String ct = file.getContentType();
        if (ct == null || !ALLOWED.contains(ct)) throw new IllegalArgumentException("Unsupported file type");
    }

    public record UploadResult(String url, String publicId) {}
}

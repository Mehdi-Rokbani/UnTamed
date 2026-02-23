// src/main/java/com/untamed/untamedbackend/model/ActivityImage.java
package com.untamed.untamedbackend.model;

import jakarta.validation.constraints.NotBlank;
import lombok.*;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ActivityImage {

    @NotBlank
    private String url;       // CDN / Cloudinary / S3 URL

    private String publicId;  // provider identifier (optional)
    private String alt;       // accessibility / SEO (optional)

    @Builder.Default
    private boolean cover = false;

    @Builder.Default
    private int order = 0;    // gallery ordering
}

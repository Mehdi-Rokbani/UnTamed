// src/main/java/com/untamed/untamedbackend/model/Category.java
package com.untamed.untamedbackend.model;

import jakarta.validation.constraints.NotBlank;
import lombok.*;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.Id;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@Document(collection = "categories")
public class Category {

    @Id
    private String id;

    @NotBlank
    @Indexed(unique = true)
    private String slug; // "hiking", "camping"

    @NotBlank
    @Indexed
    private String name; // "Hiking"

    private String description;
    private String iconUrl;

    @Builder.Default
    private boolean active = true;

    @Builder.Default
    private int sortOrder = 0;

    @CreatedDate
    private Instant createdAt;

    @LastModifiedDate
    private Instant updatedAt;
}

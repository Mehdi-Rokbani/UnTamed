package com.untamed.untamedbackend.model;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.*;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@Document(collection = "tags")
public class Tag {

    @Id
    private String id;

    @NotBlank
    @Indexed(unique = true)
    private String slug;

    @NotBlank
    private String name;

    @NotNull
    private TagType type;

    @Builder.Default
    private TagStatus status = TagStatus.AI_SUGGESTED;

    @Builder.Default
    private List<String> synonyms = List.of();

    @Builder.Default
    private boolean active = true;

    @Builder.Default
    private boolean aiSuggested = true;

    @Builder.Default
    private int usageCount = 0;

    private Integer sortOrder;
}
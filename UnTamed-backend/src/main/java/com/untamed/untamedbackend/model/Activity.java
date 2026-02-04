package com.untamed.untamedbackend.model;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;
import lombok.*;
import jakarta.validation.constraints.*;

import java.time.Instant;

@Document(collection = "activity")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Activity {

    @Id
    private String id;
    @NotBlank
    private String title;
    @NotBlank
    private String description;
    @Future
    private Instant date;
    @Min(3)
    private int capacity;
    private boolean published;
    private String guideId;
}

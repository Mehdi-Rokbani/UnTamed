package com.untamed.untamedbackend.dto;

import com.untamed.untamedbackend.model.Level;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Size;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;
import lombok.Builder;

import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class UpdateProfileRequest {

    @Size(min = 3, max = 30)
    private String username;

    private Level level;

    private List<String> preferences;

    private String profileImageUrl;

    @Size(max = 20)
    private String phoneNumber;


    @Valid
    @Size(max = 500)
    private String bio;
}

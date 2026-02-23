package com.untamed.untamedbackend.dto;

import com.untamed.untamedbackend.model.Level;
import com.untamed.untamedbackend.model.Role;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public record RegisterRequest(
        @NotBlank @Email String email,
        @NotBlank String password,
        @NotBlank String username,
        @NotNull Role role,
        Level level
) {}

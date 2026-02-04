package com.untamed.untamedbackend.controller;

import com.untamed.untamedbackend.dto.LoginRequest;
import com.untamed.untamedbackend.dto.LoginResponse;
import com.untamed.untamedbackend.dto.RegisterRequest;
import com.untamed.untamedbackend.dto.UserResponse;
import com.untamed.untamedbackend.service.AuthService;
import com.untamed.untamedbackend.service.UserService;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final AuthService authService;
    private final UserService userService;

    public AuthController(AuthService authService, UserService userService) {
        this.authService = authService;
        this.userService = userService;
    }

    @PostMapping("/login")
    public LoginResponse login(@Valid @RequestBody LoginRequest req) {
        return authService.login(req);
    }

    @PostMapping("/register")
    public UserResponse register(@Valid @RequestBody RegisterRequest req) {
        return userService.register(req);
    }
}
